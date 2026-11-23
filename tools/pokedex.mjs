// What the recommender knows about each Pokémon, from PokéAPI's data. New Pokémon come only with a new
// generation, so this is run by hand then, not daily: `node tools/pokedex.mjs`. Both files are keyed the
// way the client keys a card's Pokémon (see speciesKey in src/features/explore/recs/taste.ts), by English name.
//
// - src/features/explore/recs/families.json, evolution lines: [[pokemon, what it evolves from], ...]. A
//   collection about a Pokémon takes in what it evolves from and into (Vulpix to Ninetales; Eevee to each
//   of its eight evolutions).
// - src/features/explore/recs/types.json, types: [[pokemon, type, second type?], ...], of its usual form.
//   A collection mostly of one type (Water in an Ocean collection) leans toward that type.
import { writeFile } from "node:fs/promises";

const CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const ENGLISH = "9";
const RECS = new URL("../src/features/explore/recs/", import.meta.url);

/** Must match speciesKey in src/features/explore/recs/taste.ts. */
const key = (s) =>
  s
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

async function rows(name) {
  const r = await fetch(CSV + name + ".csv");
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  const [head, ...lines] = (await r.text()).trim().split("\n");
  const cols = head.split(",");
  // These files quote nothing that holds a comma in the columns read here.
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

/** One entry a line, so a new generation reads as a short diff. */
const write = (file, list) =>
  writeFile(new URL(file, RECS), "[\n" + list.map((p) => "  " + JSON.stringify(p)).join(",\n") + "\n]\n");

const [species, names, pokemon, pokemonTypes, types] = await Promise.all(
  ["pokemon_species", "pokemon_species_names", "pokemon", "pokemon_types", "types"].map(rows),
);
const english = new Map(
  names.filter((n) => n.local_language_id === ENGLISH).map((n) => [n.pokemon_species_id, key(n.name)]),
);
const name = (id) => english.get(id) || key(species.find((s) => s.id === id)?.identifier ?? "");

const from = species
  .filter((s) => s.evolves_from_species_id)
  .map((s) => [name(s.id), name(s.evolves_from_species_id)])
  .filter(([a, b]) => a && b);
await write("families.json", from);

const typeName = new Map(types.map((t) => [t.id, t.identifier]));
const typesOf = new Map();
for (const t of [...pokemonTypes].sort((a, b) => Number(a.slot) - Number(b.slot)))
  typesOf.set(t.pokemon_id, [...(typesOf.get(t.pokemon_id) ?? []), typeName.get(t.type_id)]);
const typed = pokemon
  .filter((p) => p.is_default === "1" && typesOf.has(p.id))
  .sort((a, b) => Number(a.species_id) - Number(b.species_id))
  .map((p) => [name(p.species_id), ...typesOf.get(p.id)])
  .filter(([n]) => n);
await write("types.json", typed);
console.log(`${from.length} evolutions, ${typed.length} Pokémon with types`);
