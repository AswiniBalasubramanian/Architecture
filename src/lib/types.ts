// ARCHFORM domain model. All plan geometry is in feet: x runs along the plot
// frontage (left → right as seen from the street), y runs from the street
// (y = 0, the front of the house) to the back of the plot.

export type HouseType = "villa" | "duplex" | "contemporary" | "traditional" | "compact";
export type DirectionId = "open" | "core" | "courtyard";
export type RoofType = "flat" | "gable" | "hip";
export type Currency = "INR" | "USD" | "EUR" | "GBP" | "AED";

export type Requirement = "parking" | "study" | "pooja" | "utility" | "garden" | "terrace" | "family";

export interface Brief {
  name: string;
  location: string;
  plotWidth: number; // ft, frontage
  plotDepth: number; // ft
  builtUp: number; // sq ft, total across floors
  floors: number;
  bedrooms: number;
  bathrooms: number;
  budget: number;
  currency: Currency;
  houseType: HouseType;
  requirements: Requirement[];
  notes: string;
  /** Editable planning assumptions (ft). */
  assumptions: Assumptions;
}

export interface Assumptions {
  setbackFront: number;
  setbackRear: number;
  setbackSide: number;
  floorHeight: number;
}

export type RoomType =
  | "living"
  | "dining"
  | "kitchen"
  | "bedroom"
  | "master"
  | "bath"
  | "stair"
  | "foyer"
  | "parking"
  | "study"
  | "family"
  | "utility"
  | "pooja"
  | "court"
  | "void";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  floor: number;
  x: number;
  y: number;
  w: number;
  d: number;
  /** Optional per-room floor finish; falls back to the design's interior floor. */
  finish?: MaterialChoice;
  /** Optional per-room wall paint. */
  wallColor?: string;
}

export type FurnitureKind =
  | "bed"
  | "sofa"
  | "coffee"
  | "dining"
  | "counter"
  | "island"
  | "wardrobe"
  | "desk"
  | "car"
  | "vanity"
  | "wc"
  | "plant"
  | "armchair"
  | "tv"
  | "shelf"
  | "rug";

export interface Furniture {
  id: string;
  kind: FurnitureKind;
  floor: number;
  x: number; // centre, ft
  y: number;
  rot: number; // degrees, 0 | 90 | 180 | 270
}

export type MaterialId =
  | "plaster"
  | "brick"
  | "stone"
  | "concrete"
  | "wood"
  | "tile"
  | "terracotta"
  | "metal"
  | "marble"
  | "lacquer"
  | "fabric"
  | "glass";

export interface MaterialChoice {
  material: MaterialId;
  color: string;
}

export type MaterialSlot =
  | "exterior"
  | "accent"
  | "roof"
  | "frames"
  | "floor"
  | "walls"
  | "cabinets"
  | "furniture";

export interface Lighting {
  hour: number; // 6..20
  interior: boolean;
}

export interface Design {
  direction: DirectionId;
  roof: RoofType;
  footprint: { x: number; y: number; w: number; d: number };
  floorHeight: number;
  rooms: Room[];
  furniture: Furniture[];
  materials: Record<MaterialSlot, MaterialChoice>;
  lighting: Lighting;
  exteriorTemplate: string;
  interiorTemplate: string;
}

export interface Version {
  id: string;
  at: number;
  label: string;
  design: Design;
}

export interface Project {
  id: string;
  createdAt: number;
  updatedAt: number;
  architect: string;
  brief: Brief;
  /** The generated concept, kept so "Reset" can return to it. */
  generated: Design | null;
  design: Design | null;
  versions: Version[];
}

/** What a buyer link carries. Self-contained so it opens on any device. */
export interface SharedProject {
  v: 1;
  name: string;
  architect: string;
  brief: Brief;
  design: Design;
  sharedAt: number;
}
