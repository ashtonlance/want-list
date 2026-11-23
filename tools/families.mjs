// Evolution lines (Vulpix to Ninetales; Eevee to each of its eight evolutions), from PokéAPI's data, for the
// recommender: a collection about a Pokémon takes in what it evolves from and into. New Pokémon come only
// with a new generation, so this is run by hand then, not daily: `node tools/families.mjs`.
//
// Writes src/features/explore/recs/families.json: [[pokemon, what it evolves from], ...], by English name,
// keyed the way the client keys a card's Pokémon (see speciesKey in taste.ts).
import { writeFile } from "node:fs/promises";

const CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const ENGLISH = "9";
const OUT = new URL("../src/features/explore/recs/families.json", import.meta.url);

/** Must match speciesKey in src/features/explore/recs/taste.ts. */
const key = (s) =>
  s
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

async function rows(name) {
  const r = await fetch(CSV + name + ".csv");
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  const [head, ...lines] = (await r.text()).trim().split("\n");
  const cols = head.split(",");
  // These two files quote nothing that holds a comma in the columns read here.
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

const species = await rows("pokemon_species");
const names = await rows("pokemon_species_names");
const english = new Map(
  names.filter((n) => n.local_language_id === ENGLISH).map((n) => [n.pokemon_species_id, key(n.name)]),
);
const name = (id) => english.get(id) || key(species.find((s) => s.id === id)?.identifier ?? "");

const from = species
  .filter((s) => s.evolves_from_species_id)
  .map((s) => [name(s.id), name(s.evolves_from_species_id)])
  .filter(([a, b]) => a && b);
// One evolution a line, so a new generation reads as a short diff.
await writeFile(OUT, "[\n" + from.map((p) => "  " + JSON.stringify(p)).join(",\n") + "\n]\n");
console.log(`${from.length} evolutions`);
