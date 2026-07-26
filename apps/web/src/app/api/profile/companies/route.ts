import { NextResponse } from "next/server";
import { requireAuthAndRateLimit } from "@/lib/server/require-auth-rate-limit";

const FALLBACK_COMPANIES = [
  "Accenture",
  "Adobe",
  "Amazon",
  "Apple",
  "Atlassian",
  "Capgemini",
  "Cognizant",
  "Deloitte",
  "Flipkart",
  "Google",
  "HCLTech",
  "IBM",
  "Infosys",
  "LTIMindtree",
  "Meta",
  "Microsoft",
  "Netflix",
  "Oracle",
  "Paytm",
  "PhonePe",
  "Salesforce",
  "Swiggy",
  "Tata Consultancy Services",
  "Tech Mahindra",
  "Uber",
  "Wipro",
  "Zomato"
];

type ClearbitCompany = {
  domain?: string;
  logo?: string;
  name?: string;
};

function fallbackCompanyResults(query: string) {
  const normalized = query.toLowerCase();
  const matches = FALLBACK_COMPANIES.filter((company) => company.toLowerCase().includes(normalized)).slice(0, 8);
  const base = matches.map((name) => ({ id: name, label: name, source: "fallback" }));
  return query ? [...base, { id: `other-${query}`, label: `Other: ${query}`, source: "custom" }] : base;
}

export async function GET(request: Request) {
  const gate = await requireAuthAndRateLimit(request, "profile-companies", { maxRequests: 60 });
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL("https://autocomplete.clearbit.com/v1/companies/suggest");
    url.searchParams.set("query", query);

    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) {
      throw new Error("Company autocomplete provider failed.");
    }

    const payload = (await response.json()) as ClearbitCompany[];
    const results = payload
      .map((company) => ({
        domain: company.domain || "",
        id: company.domain || company.name || "",
        label: company.name || company.domain || "",
        logo: company.logo || "",
        source: "clearbit"
      }))
      .filter((entry) => entry.label)
      .slice(0, 8);

    const custom = { id: `other-${query}`, label: `Other: ${query}`, source: "custom" };
    return NextResponse.json({ results: results.length > 0 ? [...results, custom] : fallbackCompanyResults(query) });
  } catch {
    return NextResponse.json({ results: fallbackCompanyResults(query) });
  }
}
