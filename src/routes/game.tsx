import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AsykGame } from "@/game/AsykGame";

export const Route = createFileRoute("/game")({
  head: () => ({
    meta: [
      { title: "Play — Асық Ату" },
      { name: "description", content: "Play the modern Asyk Atu arcade game." },
    ],
  }),
  component: GamePage,
});

function GamePage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-arena p-4 md:p-6 flex items-center justify-center">
      <AsykGame onExit={() => navigate({ to: "/" })} />
    </div>
  );
}
