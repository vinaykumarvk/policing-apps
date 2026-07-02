// Dignitaries shown on the login screen. To display real photographs, place
// image files under src/assets/officials/ and set photoUrl via an import:
//   import cmPhoto from "./assets/officials/chief-minister.jpg";
//   { ..., photoUrl: cmPhoto }
// Leave name as null to show the designation only.
export interface Official {
  id: string;
  title: string;
  titleMl: string;
  name: string | null;
  photoUrl: string | null;
}

export const OFFICIALS: readonly Official[] = [
  {
    id: "chief-minister",
    title: "Hon'ble Chief Minister",
    titleMl: "ബഹു. മുഖ്യമന്ത്രി",
    name: null,
    photoUrl: null,
  },
  {
    id: "home-minister",
    title: "Hon'ble Minister for Home",
    titleMl: "ബഹു. ആഭ്യന്തര മന്ത്രി",
    name: null,
    photoUrl: null,
  },
  {
    id: "dgp",
    title: "Director General of Police",
    titleMl: "പോലീസ് ഡയറക്ടർ ജനറൽ",
    name: null,
    photoUrl: null,
  },
  {
    id: "adgp-intelligence",
    title: "ADGP, Intelligence",
    titleMl: "എ.ഡി.ജി.പി, ഇന്റലിജൻസ്",
    name: null,
    photoUrl: null,
  },
];
