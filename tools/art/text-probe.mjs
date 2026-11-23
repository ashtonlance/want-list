// Probe: CLIP text embeddings for scene prompts, to test zero-shot scene tags against art.bin.
import { writeFile } from "node:fs/promises";
import { AutoTokenizer, CLIPTextModelWithProjection, env } from "@huggingface/transformers";
if (process.env.HF_CACHE_DIR) env.cacheDir = process.env.HF_CACHE_DIR;
const MODEL = "Xenova/clip-vit-base-patch32";
const SCENES = [
  "an underwater scene", "the open ocean", "a sandy beach", "ocean waves", "a river", "a lake", "a waterfall",
  "a forest", "a jungle", "a meadow with tall grass", "flowers", "a flower garden", "leaves and plants",
  "outer space with stars", "the night sky", "the moon", "planets", "a desert", "ancient Egyptian pyramids",
  "ancient ruins", "a city street", "a cave", "mountains", "snow and ice", "a volcano", "fire and flames",
  "clouds in the sky", "rain", "a sunset", "a cozy room indoors", "food", "something cute", "a dark gloomy scene",
  "a bright pastel scene", "a spooky haunted place", "rocks and stones", "crystals and gems", "autumn leaves",
  "a farm", "a swamp", "a festival with lights", "books", "a kitchen", "a school", "a train", "the seashore with shells",
  "coral reef", "fish swimming", "a pond", "lightning", "a park", "a bedroom", "a toy", "a castle", "a temple", "a shrine",
];
const prompts = SCENES.map((s) => `a trading card illustration of ${s}`);
const tok = await AutoTokenizer.from_pretrained(MODEL);
const model = await CLIPTextModelWithProjection.from_pretrained(MODEL);
const { text_embeds } = await model(tok(prompts, { padding: true, truncation: true }));
const dims = text_embeds.dims[1];
const out = SCENES.map((s, i) => ({ s, v: Array.from(text_embeds.data.slice(i * dims, (i + 1) * dims)) }));
await writeFile("tools/art/text-probe.json", JSON.stringify(out));
console.log("wrote", out.length, dims);
