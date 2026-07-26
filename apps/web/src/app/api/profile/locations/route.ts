import { NextResponse } from "next/server";
import { requireAuthAndRateLimit } from "@/lib/server/require-auth-rate-limit";

const FALLBACK_LOCATIONS = [
  "Bengaluru, Karnataka, India",
  "Hyderabad, Telangana, India",
  "Pune, Maharashtra, India",
  "Mumbai, Maharashtra, India",
  "Delhi, India",
  "Gurugram, Haryana, India",
  "Noida, Uttar Pradesh, India",
  "Chennai, Tamil Nadu, India",
  "Kolkata, West Bengal, India",
  "Ahmedabad, Gujarat, India",
  "Kochi, Kerala, India",
  "Indore, Madhya Pradesh, India",
  "Jaipur, Rajasthan, India",
  "Remote, India"
];

type NominatimAddress = {
  city?: string;
  country?: string;
  state?: string;
  town?: string;
  village?: string;
};

type NominatimPlace = {
  address?: NominatimAddress;
  display_name?: string;
  place_id?: number;
};

function fallbackLocationResults(query: string) {
  const normalized = query.toLowerCase();
  return FALLBACK_LOCATIONS.filter((location) => location.toLowerCase().includes(normalized))
    .slice(0, 8)
    .map((label) => ({ id: label, label, source: "fallback" }));
}

function normalizePlace(place: NominatimPlace) {
  const address = place.address ?? {};
  const city = address.city || address.town || address.village || "";
  const state = address.state || "";
  const country = address.country || "India";
  const label = [city, state, country].filter(Boolean).join(", ") || place.display_name || "";

  return label
    ? {
        id: String(place.place_id ?? label),
        label,
        source: "nominatim"
      }
    : null;
}

export async function GET(request: Request) {
  const gate = await requireAuthAndRateLimit(request, "profile-locations", { maxRequests: 60 });
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "in");
    url.searchParams.set("limit", "8");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "CareerOS/1.0 location autocomplete",
        Referer: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      },
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) {
      throw new Error("Location autocomplete provider failed.");
    }

    const payload = (await response.json()) as NominatimPlace[];
    const seen = new Set<string>();
    const results = payload
      .map(normalizePlace)
      .filter((entry): entry is { id: string; label: string; source: string } => Boolean(entry))
      .filter((entry) => {
        const key = entry.label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return NextResponse.json({ results: results.length > 0 ? results : fallbackLocationResults(query) });
  } catch {
    return NextResponse.json({ results: fallbackLocationResults(query) });
  }
}
