import type { Currency, DirectionId, FurnitureKind, HouseType, MaterialChoice, MaterialId, MaterialSlot, Requirement, RoofType, RoomType } from "./types";

export const HOUSE_TYPES: Record<HouseType, { label: string; blurb: string; roof: RoofType; floors: number }> = {
  villa: { label: "Villa", blurb: "Generous rooms, garden-facing, pitched roof", roof: "hip", floors: 2 },
  duplex: { label: "Duplex", blurb: "Two stacked levels, private upstairs", roof: "flat", floors: 2 },
  contemporary: { label: "Contemporary", blurb: "Flat roof, deep glazing, open plan", roof: "flat", floors: 2 },
  traditional: { label: "Traditional", blurb: "Sloped tiled roof, courtyard living", roof: "gable", floors: 1 },
  compact: { label: "Compact home", blurb: "Efficient footprint for tight plots", roof: "flat", floors: 2 },
};

export const DIRECTIONS: Record<DirectionId, { label: string; blurb: string }> = {
  open: { label: "Open Linear", blurb: "Stair along one side, a single long living–dining volume and light from three faces." },
  core: { label: "Central Core", blurb: "Stair and services stacked at the centre; rooms wrap the core, short walking distances." },
  courtyard: { label: "Courtyard", blurb: "An open-to-sky court at the heart of the plan, with rooms facing inward." },
};

export const REQUIREMENTS: Record<Requirement, string> = {
  parking: "Covered parking",
  study: "Study / home office",
  pooja: "Prayer room",
  utility: "Utility & laundry",
  garden: "Garden-facing living",
  terrace: "Roof terrace",
  family: "Family lounge upstairs",
};

export const CURRENCIES: Record<Currency, { symbol: string; locale: string }> = {
  INR: { symbol: "₹", locale: "en-IN" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
  GBP: { symbol: "£", locale: "en-GB" },
  AED: { symbol: "AED ", locale: "en-AE" },
};

export const ROOM_TYPES: Record<RoomType, { label: string; tint: string; habitable: boolean }> = {
  living: { label: "Living", tint: "#efe7d8", habitable: true },
  dining: { label: "Dining", tint: "#efe4d2", habitable: true },
  kitchen: { label: "Kitchen", tint: "#e7e4d6", habitable: true },
  bedroom: { label: "Bedroom", tint: "#e4e6dc", habitable: true },
  master: { label: "Master bedroom", tint: "#dfe5da", habitable: true },
  bath: { label: "Bath", tint: "#dfe6e6", habitable: false },
  stair: { label: "Stair", tint: "#e6e2dc", habitable: false },
  foyer: { label: "Foyer", tint: "#ece6dc", habitable: false },
  parking: { label: "Parking", tint: "#e4e2de", habitable: false },
  study: { label: "Study", tint: "#e9e3d6", habitable: true },
  family: { label: "Family lounge", tint: "#ece4d4", habitable: true },
  utility: { label: "Utility", tint: "#e3e3df", habitable: false },
  pooja: { label: "Prayer room", tint: "#f0e3cf", habitable: false },
  court: { label: "Courtyard", tint: "#dde6d6", habitable: false },
  void: { label: "Void over court", tint: "#e8ece4", habitable: false },
};

export const MATERIALS: Record<MaterialId, { label: string; color: string; roughness: number; metalness: number }> = {
  plaster: { label: "Lime plaster", color: "#ece6da", roughness: 0.92, metalness: 0 },
  brick: { label: "Exposed brick", color: "#a65d44", roughness: 0.9, metalness: 0 },
  stone: { label: "Natural stone", color: "#b9ae9c", roughness: 0.85, metalness: 0 },
  concrete: { label: "Board-formed concrete", color: "#a9a7a1", roughness: 0.88, metalness: 0 },
  wood: { label: "Timber", color: "#a77a4f", roughness: 0.7, metalness: 0 },
  tile: { label: "Ceramic tile", color: "#d8d2c6", roughness: 0.4, metalness: 0 },
  terracotta: { label: "Terracotta tile", color: "#b5643f", roughness: 0.8, metalness: 0 },
  metal: { label: "Standing-seam metal", color: "#4b4f4e", roughness: 0.45, metalness: 0.6 },
  marble: { label: "Marble", color: "#e9e6e0", roughness: 0.25, metalness: 0 },
  lacquer: { label: "Matte lacquer", color: "#5f6b5d", roughness: 0.55, metalness: 0 },
  fabric: { label: "Woven fabric", color: "#b8ad9a", roughness: 1, metalness: 0 },
  glass: { label: "Glass", color: "#9fb6b8", roughness: 0.05, metalness: 0.1 },
};

/** Which materials make sense in each slot. */
export const SLOTS: Record<MaterialSlot, { label: string; group: "Exterior" | "Interior"; materials: MaterialId[] }> = {
  exterior: { label: "Walls", group: "Exterior", materials: ["plaster", "brick", "stone", "concrete", "wood"] },
  accent: { label: "Facade accent", group: "Exterior", materials: ["wood", "stone", "brick", "concrete", "metal"] },
  roof: { label: "Roof", group: "Exterior", materials: ["concrete", "terracotta", "metal", "tile"] },
  frames: { label: "Window frames", group: "Exterior", materials: ["metal", "wood"] },
  floor: { label: "Floors", group: "Interior", materials: ["wood", "tile", "stone", "marble", "concrete"] },
  walls: { label: "Walls", group: "Interior", materials: ["plaster", "brick", "wood", "concrete"] },
  cabinets: { label: "Cabinets", group: "Interior", materials: ["wood", "lacquer", "marble"] },
  furniture: { label: "Upholstery", group: "Interior", materials: ["fabric", "wood"] },
};

export const SWATCHES = ["#f1ece2", "#e6dccb", "#cfc3ae", "#b9ae9c", "#a9a7a1", "#7d7b75", "#3f4240", "#2c2e2d", "#a77a4f", "#7a5236", "#b5643f", "#a65d44", "#8a9a7b", "#5f6b5d", "#4e5d57", "#9fb6b8"];

type Templ = { id: string; label: string; blurb: string; set: Partial<Record<MaterialSlot, MaterialChoice>> };

export const EXTERIOR_TEMPLATES: Templ[] = [
  {
    id: "lime-teak",
    label: "Lime & Teak",
    blurb: "Warm lime plaster, teak screens, clay roof",
    set: { exterior: { material: "plaster", color: "#ece4d4" }, accent: { material: "wood", color: "#8f6440" }, roof: { material: "terracotta", color: "#b0603d" }, frames: { material: "wood", color: "#5d4129" } },
  },
  {
    id: "board-concrete",
    label: "Board-formed",
    blurb: "Raw concrete, charcoal frames, flat roof",
    set: { exterior: { material: "concrete", color: "#aeaba4" }, accent: { material: "wood", color: "#7a5236" }, roof: { material: "concrete", color: "#9c9a94" }, frames: { material: "metal", color: "#2c2e2d" } },
  },
  {
    id: "laterite",
    label: "Laterite & Clay",
    blurb: "Earthy brick, stone plinth, terracotta",
    set: { exterior: { material: "brick", color: "#a65d44" }, accent: { material: "stone", color: "#b9ae9c" }, roof: { material: "terracotta", color: "#9e5434" }, frames: { material: "wood", color: "#4a3322" } },
  },
  {
    id: "nordic",
    label: "Nordic Timber",
    blurb: "Charred timber, metal roof, slim frames",
    set: { exterior: { material: "wood", color: "#4f4a42" }, accent: { material: "wood", color: "#b58a5c" }, roof: { material: "metal", color: "#3a3d3c" }, frames: { material: "metal", color: "#1f2120" } },
  },
  {
    id: "white-stone",
    label: "White & Stone",
    blurb: "Bright render with a dry-stone base",
    set: { exterior: { material: "plaster", color: "#f4f1ea" }, accent: { material: "stone", color: "#c9bda7" }, roof: { material: "tile", color: "#cfc8bb" }, frames: { material: "metal", color: "#4e5d57" } },
  },
];

export const INTERIOR_TEMPLATES: Templ[] = [
  {
    id: "warm-minimal",
    label: "Warm Minimal",
    blurb: "Oak floors, chalk walls, sage cabinetry",
    set: { floor: { material: "wood", color: "#b48a5e" }, walls: { material: "plaster", color: "#f1ece2" }, cabinets: { material: "lacquer", color: "#8a9a7b" }, furniture: { material: "fabric", color: "#cfc3ae" } },
  },
  {
    id: "japandi",
    label: "Japandi",
    blurb: "Pale ash, paper-white, charcoal accents",
    set: { floor: { material: "wood", color: "#cdb48e" }, walls: { material: "plaster", color: "#f4f0e8" }, cabinets: { material: "wood", color: "#3f4240" }, furniture: { material: "fabric", color: "#e6dccb" } },
  },
  {
    id: "stone-loft",
    label: "Stone Loft",
    blurb: "Polished concrete, brick, walnut",
    set: { floor: { material: "concrete", color: "#a3a19b" }, walls: { material: "brick", color: "#9f5c46" }, cabinets: { material: "wood", color: "#5a3c26" }, furniture: { material: "fabric", color: "#5f6b5d" } },
  },
  {
    id: "classic-teak",
    label: "Classic Teak",
    blurb: "Marble floors, teak joinery, cream walls",
    set: { floor: { material: "marble", color: "#ebe7df" }, walls: { material: "plaster", color: "#ede3cf" }, cabinets: { material: "wood", color: "#7a5236" }, furniture: { material: "fabric", color: "#a77a4f" } },
  },
];

/** Room-level quick finishes (floor + wall paint). */
export const ROOM_TEMPLATES: Array<{ id: string; label: string; finish: MaterialChoice; wall: string }> = [
  { id: "oak", label: "Oak & chalk", finish: { material: "wood", color: "#b48a5e" }, wall: "#f1ece2" },
  { id: "terrazzo", label: "Terrazzo & sage", finish: { material: "tile", color: "#ddd6c8" }, wall: "#d7dccd" },
  { id: "slate", label: "Slate & clay", finish: { material: "stone", color: "#7d7b75" }, wall: "#e2cdb6" },
  { id: "marble", label: "Marble & cream", finish: { material: "marble", color: "#ebe7df" }, wall: "#ede3cf" },
  { id: "concrete", label: "Concrete & ink", finish: { material: "concrete", color: "#a3a19b" }, wall: "#4e5d57" },
];

/** Plan footprint (ft) of each piece of furniture, and its label. */
export const FURNITURE: Record<FurnitureKind, { label: string; w: number; d: number; h: number; rooms: RoomType[] }> = {
  bed: { label: "Bed", w: 6, d: 6.8, h: 2, rooms: ["bedroom", "master"] },
  sofa: { label: "Sofa", w: 7.5, d: 3, h: 2.6, rooms: ["living", "family"] },
  armchair: { label: "Armchair", w: 2.8, d: 2.8, h: 2.6, rooms: ["living", "family", "master", "study"] },
  coffee: { label: "Coffee table", w: 3.6, d: 2, h: 1.3, rooms: ["living", "family"] },
  rug: { label: "Rug", w: 8, d: 5.5, h: 0.05, rooms: ["living", "family", "bedroom", "master", "dining"] },
  tv: { label: "Media unit", w: 6, d: 1.4, h: 1.8, rooms: ["living", "family", "master"] },
  dining: { label: "Dining table", w: 6, d: 3.4, h: 2.5, rooms: ["dining", "kitchen"] },
  counter: { label: "Kitchen run", w: 8, d: 2, h: 3, rooms: ["kitchen", "utility"] },
  island: { label: "Island", w: 5, d: 2.6, h: 3, rooms: ["kitchen"] },
  wardrobe: { label: "Wardrobe", w: 6, d: 2, h: 7, rooms: ["bedroom", "master"] },
  desk: { label: "Desk", w: 4.5, d: 2.2, h: 2.5, rooms: ["study", "bedroom", "family"] },
  shelf: { label: "Bookshelf", w: 4, d: 1.2, h: 6.5, rooms: ["study", "living", "family"] },
  car: { label: "Car", w: 6.2, d: 14.5, h: 4.8, rooms: ["parking"] },
  vanity: { label: "Vanity", w: 3.2, d: 1.8, h: 2.8, rooms: ["bath"] },
  wc: { label: "WC", w: 1.6, d: 2.4, h: 1.4, rooms: ["bath"] },
  plant: { label: "Planter", w: 1.6, d: 1.6, h: 3.8, rooms: ["living", "court", "foyer", "family", "dining", "study"] },
};

export const FLOOR_NAMES = ["Ground floor", "First floor", "Second floor", "Third floor"];
export const floorName = (floor: number) => FLOOR_NAMES[floor] ?? `Floor ${floor}`;
