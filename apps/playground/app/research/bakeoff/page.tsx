import { EngineBakeoff } from "./_components/EngineBakeoff";

export const metadata = {
  title: "Glaze engine bake-off",
  description:
    "A neutral, real-scale comparison of three rendering strategies for Glaze.",
};

const CANDIDATES = ["owned-svg", "explicit-webgl", "css-baseline"] as const;
const SCENES = ["light", "dark", "photo", "text", "motion"] as const;

type CandidateId = (typeof CANDIDATES)[number];
type SceneId = (typeof SCENES)[number];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isCandidate(value: string | undefined): value is CandidateId {
  return CANDIDATES.some((candidate) => candidate === value);
}

function isScene(value: string | undefined): value is SceneId {
  return SCENES.some((scene) => scene === value);
}

export default async function BakeoffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedCandidate = firstValue(query.candidate);
  const requestedScene = firstValue(query.scene);

  return (
    <EngineBakeoff
      initialCandidate={
        isCandidate(requestedCandidate) ? requestedCandidate : null
      }
      initialScene={isScene(requestedScene) ? requestedScene : "photo"}
    />
  );
}
