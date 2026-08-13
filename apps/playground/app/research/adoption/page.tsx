import { AdoptionProbe, type AdoptionCase } from "./_components/AdoptionProbe";

export const metadata = {
  title: "Glaze candidate adoption probe",
  description: "Gate 3 due diligence for the owned-DOM liquid-glass candidate.",
};

const CASES = ["dom", "duplicate", "webgl", "optics"] as const;

function isCase(value: string | string[] | undefined): value is AdoptionCase {
  return typeof value === "string" && CASES.some((item) => item === value);
}

export default async function AdoptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <AdoptionProbe caseId={isCase(query.case) ? query.case : "dom"} />;
}
