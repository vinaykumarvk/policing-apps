// Dignitaries shown on the login screen. Photographs live under
// src/assets/officials/ and are imported so Vite fingerprints + bundles them.
// Names/photos current as of the 2026 Kerala (UDF) government.
import cmPhoto from "./assets/officials/chief-minister.jpg";
import homePhoto from "./assets/officials/home-minister.jpg";
import dgpPhoto from "./assets/officials/dgp.jpg";

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
    name: "V. D. Satheesan",
    photoUrl: cmPhoto,
  },
  {
    id: "home-minister",
    title: "Hon'ble Minister for Home & Vigilance",
    titleMl: "ബഹു. ആഭ്യന്തര മന്ത്രി",
    name: "Ramesh Chennithala",
    photoUrl: homePhoto,
  },
  {
    id: "dgp",
    title: "Director General of Police & State Police Chief",
    titleMl: "പോലീസ് ഡയറക്ടർ ജനറൽ",
    name: "Ravada A. Chandrasekhar",
    photoUrl: dgpPhoto,
  },
];
