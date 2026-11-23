// Scene directions: what "an underwater scene" or "a forest" looks like in art.bin's terms, so the app can
// tell what a collection's cards show (Ocean: sea creatures under water) and suggest cards that show it too.
// Runs in GitHub Actions after the art fingerprints (.github/workflows/art.yml).
//
// Each scene's description goes through CLIP's text encoder, the partner of the image encoder that made
// the fingerprints, so a picture and a description of it land close together. The text vector is then
// turned with the same PCA axes as the pictures (tools/art/pca.bin). How far along a scene's direction a
// card sits, compared with every other card, is how much it shows that scene; the app works out that
// comparison from art.bin itself.
//
// Writes src/features/explore/recs/scenes.json: { dims, scenes: [{ label, words, v }] }. It only changes
// when SCENES or pca.bin do.
import { readFile, writeFile } from "node:fs/promises";
import { AutoTokenizer, CLIPTextModelWithProjection, env } from "@huggingface/transformers";
import { decodePca } from "./pca.mjs";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("src/features/explore/recs/scenes.json", ROOT);
const MODEL = "Xenova/clip-vit-base-patch32";

/**
 * label: how a pick's reason names it ("Underwater scene, like the cards in Ocean").
 * prompt: what CLIP is shown, after "a trading card illustration of".
 * words: collection-name words that ask for it (a collection called Ocean leans toward its sea scenes).
 */
const SCENES = [
  { label: "Underwater scene", prompt: "an underwater scene", words: ["ocean", "sea", "underwater", "aquatic", "marine", "deep"] },
  { label: "Open ocean", prompt: "the open ocean", words: ["ocean", "sea", "marine", "nautical"] },
  { label: "Ocean waves", prompt: "ocean waves", words: ["ocean", "sea", "waves", "surf"] },
  { label: "Coral reef", prompt: "a coral reef", words: ["ocean", "sea", "reef", "coral", "tropical"] },
  { label: "Fish swimming", prompt: "fish swimming", words: ["ocean", "sea", "fish", "aquarium", "aquatic"] },
  { label: "Seashore", prompt: "the seashore with shells", words: ["beach", "shore", "coast", "seaside", "ocean"] },
  { label: "Beach", prompt: "a sandy beach", words: ["beach", "summer", "coast", "seaside", "tropical"] },
  { label: "River", prompt: "a river", words: ["river", "stream", "water"] },
  { label: "Lake", prompt: "a lake", words: ["lake", "water"] },
  { label: "Pond", prompt: "a pond", words: ["pond", "water"] },
  { label: "Waterfall", prompt: "a waterfall", words: ["waterfall", "water"] },
  { label: "Rain", prompt: "rain", words: ["rain", "rainy", "storm", "weather"] },
  { label: "Forest", prompt: "a forest", words: ["forest", "woods", "woodland", "trees", "nature"] },
  { label: "Jungle", prompt: "a jungle", words: ["jungle", "rainforest", "tropical"] },
  { label: "Leaves and plants", prompt: "leaves and plants", words: ["botanical", "plants", "plant", "leaves", "greenery", "nature", "garden"] },
  { label: "Flowers", prompt: "flowers", words: ["flowers", "flower", "floral", "botanical", "blossom", "bloom", "spring"] },
  { label: "Flower garden", prompt: "a flower garden", words: ["garden", "flowers", "floral", "botanical"] },
  { label: "Meadow", prompt: "a meadow with tall grass", words: ["meadow", "grass", "field", "fields", "nature"] },
  { label: "Autumn leaves", prompt: "autumn leaves", words: ["autumn", "fall", "leaves", "halloween"] },
  { label: "Swamp", prompt: "a swamp", words: ["swamp", "bog", "marsh"] },
  { label: "Park", prompt: "a park", words: ["park", "picnic"] },
  { label: "Farm", prompt: "a farm", words: ["farm", "barn", "countryside"] },
  { label: "Outer space", prompt: "outer space with stars", words: ["space", "cosmic", "cosmos", "galaxy", "stars", "astro", "universe"] },
  { label: "Night sky", prompt: "the night sky full of stars", words: ["night", "stars", "starry", "space", "sky"] },
  { label: "Moon", prompt: "the moon", words: ["moon", "lunar", "night", "space"] },
  { label: "Planets", prompt: "planets", words: ["planets", "planet", "space", "cosmic", "galaxy"] },
  { label: "Galaxy", prompt: "a colorful galaxy", words: ["galaxy", "space", "cosmic", "cosmos", "nebula"] },
  { label: "Clouds", prompt: "clouds in the sky", words: ["sky", "clouds", "cloud", "flying", "air", "heaven"] },
  { label: "Sunset", prompt: "a sunset", words: ["sunset", "sunrise", "dusk", "golden"] },
  { label: "Lightning", prompt: "lightning", words: ["lightning", "storm", "thunder", "electric"] },
  { label: "Snow and ice", prompt: "snow and ice", words: ["snow", "ice", "icy", "winter", "frozen", "cold", "christmas", "holiday"] },
  { label: "Mountains", prompt: "mountains", words: ["mountain", "mountains", "peaks", "alpine", "hiking"] },
  { label: "Desert", prompt: "a desert with sand dunes", words: ["desert", "sand", "dunes", "egypt", "dry"] },
  { label: "Ancient Egypt", prompt: "ancient Egyptian pyramids and hieroglyphs", words: ["egypt", "egyptian", "pyramid", "pyramids", "pharaoh", "mummy"] },
  { label: "Ancient ruins", prompt: "ancient ruins", words: ["ruins", "ancient", "egypt", "relic", "relics", "history", "archaeology"] },
  { label: "Temple", prompt: "a temple", words: ["temple", "ancient", "shrine", "egypt"] },
  { label: "Shrine", prompt: "a japanese shrine", words: ["shrine", "japan", "japanese"] },
  { label: "Castle", prompt: "a castle", words: ["castle", "medieval", "kingdom", "royal", "knight"] },
  { label: "Cave", prompt: "a cave", words: ["cave", "caves", "underground", "cavern"] },
  { label: "Rocks and stones", prompt: "rocks and stones", words: ["rock", "rocks", "stone", "stones", "fossil", "fossils"] },
  { label: "Crystals and gems", prompt: "crystals and gems", words: ["crystal", "crystals", "gem", "gems", "jewel", "jewels", "minerals", "mineral"] },
  { label: "Volcano", prompt: "a volcano", words: ["volcano", "lava", "magma", "fire"] },
  { label: "Fire and flames", prompt: "fire and flames", words: ["fire", "flame", "flames", "burning", "inferno", "hot"] },
  { label: "City street", prompt: "a city street", words: ["city", "urban", "street", "town", "downtown"] },
  { label: "Train", prompt: "a train", words: ["train", "trains", "railway", "station"] },
  { label: "School", prompt: "a school", words: ["school", "class", "academy"] },
  { label: "Cozy room", prompt: "a cozy room indoors", words: ["cozy", "home", "house", "indoors", "comfy", "chill"] },
  { label: "Bedroom", prompt: "a bedroom", words: ["bedroom", "bed", "sleep", "sleepy", "sleeping", "nap"] },
  { label: "Kitchen", prompt: "a kitchen", words: ["kitchen", "cooking", "chef", "baking"] },
  { label: "Food", prompt: "food", words: ["food", "foodie", "snack", "snacks", "sweets", "dessert", "candy", "baking"] },
  { label: "Books", prompt: "books", words: ["books", "book", "library", "reading", "study"] },
  { label: "Toys", prompt: "a toy", words: ["toy", "toys", "play", "plush"] },
  { label: "Festival lights", prompt: "a festival with lights", words: ["festival", "party", "celebration", "lanterns", "fireworks"] },
  { label: "Cute", prompt: "something cute", words: ["cute", "kawaii", "adorable", "sweet", "baby", "babies"] },
  { label: "Sleepy and relaxed", prompt: "a sleepy relaxed creature", words: ["sleepy", "sleep", "lazy", "relaxed", "chill", "stoned", "nap", "cozy"] },
  { label: "Funny", prompt: "a funny goofy creature", words: ["funny", "goofy", "silly", "derp", "meme", "memes", "weird"] },
  { label: "Dark and gloomy", prompt: "a dark gloomy scene", words: ["dark", "gloomy", "night", "shadow", "shadows", "moody", "gothic", "goth"] },
  { label: "Dark background", prompt: "a creature on a black background", words: ["dark", "black", "noir", "night"] },
  { label: "Spooky", prompt: "a spooky haunted place", words: ["spooky", "haunted", "ghost", "ghosts", "halloween", "creepy", "scary", "horror"] },
  { label: "Bright and light", prompt: "a creature on a bright white background", words: ["light", "bright", "white", "pale", "minimal", "minimalist", "clean"] },
  { label: "Pastel colors", prompt: "soft pastel colors", words: ["pastel", "soft", "light", "pink", "dreamy", "cute"] },
  { label: "Glowing light", prompt: "glowing magical light", words: ["light", "glow", "glowing", "magic", "magical", "sparkle", "shiny"] },
];

if (process.env.HF_CACHE_DIR) env.cacheDir = process.env.HF_CACHE_DIR;
const pca = decodePca(await readFile(new URL("tools/art/pca.bin", ROOT)));
const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: "fp32" });
const prompts = SCENES.map((s) => `a trading card illustration of ${s.prompt}`);
const { text_embeds } = await model(tokenizer(prompts, { padding: true, truncation: true }));
const width = text_embeds.dims[1];
if (width !== pca.width) throw new Error(`text vectors are ${width} wide, pca.bin expects ${pca.width}`);

// Unit length, as the picture vectors were before PCA, then onto the same axes. The pictures' mean isn't
// taken off: it only moves every card's score for a scene by the same amount, which the app's comparison
// with every other card removes.
const scenes = SCENES.map(({ label, words }, i) => {
  const t = text_embeds.data.subarray(i * width, (i + 1) * width);
  const norm = Math.hypot(...t) || 1;
  const v = [];
  for (let k = 0; k < pca.dims; k++) {
    let s = 0;
    for (let a = 0; a < width; a++) s += (t[a] / norm) * pca.axes[k * width + a];
    v.push(Number(s.toFixed(5)));
  }
  return { label, words, v };
});
// One scene a line, so a changed list reads as a short diff.
const body = scenes.map((s) => "    " + JSON.stringify(s)).join(",\n");
await writeFile(OUT, `{\n  "dims": ${pca.dims},\n  "scenes": [\n${body}\n  ]\n}\n`);
console.log(`scenes.json: ${scenes.length} scenes x ${pca.dims} dims`);
