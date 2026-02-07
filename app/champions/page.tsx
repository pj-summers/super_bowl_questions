import Link from "next/link";

type Champion = {
  year: string;
  name: string;
  correct: number;
  runnerUp: string;
};

const CHAMPIONS: Champion[] = [
  {
    year: "LIX",
    name: "Tommy Girsch",
    correct: 20,
    runnerUp: "Jon Summers, Kris Burkhardt",
  },
  {
    year: "LVIII",
    name: "Angel Ortiz",
    correct: 18,
    runnerUp: "PJ Summers, Charlie Morris, Warren Young",
  },
  {
    year: "LVII",
    name: "Charlie Morris, Kevin Rankel",
    correct: 18,
    runnerUp: "Jon Summers, Dave Gerst",
  },
  {
    year: "LVI",
    name: "Michelle Osburn",
    correct: 21,
    runnerUp: "Sean Conway",
  },
  {
    year: "LV",
    name: "Jon Summers, Alex Goworowski, Tony Cali, Mike Knez",
    correct: 19,
    runnerUp: "N/A",
  },
  {
    year: "LIV",
    name: "Warren Young",
    correct: 23,
    runnerUp: "Kent Zinn",
  },
  {
    year: "LIII",
    name: "Bill Hub",
    correct: 21,
    runnerUp: "Shoe",
  },
  {
    year: "LII",
    name: "Jim Micka",
    correct: 18,
    runnerUp: "PJ Summers, Bill Hub",
  },
];

export default function ChampionsPage() {
  const championsSorted = CHAMPIONS;

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Past Champions</h1>
          <p className="mt-1 text-sm text-gray-600">
            The legends of Super Bowl Questions.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href="/"
          >
            Join →
          </Link>
          <Link
            className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            href="/leaderboard/LX"
          >
            Leaderboard →
          </Link>
        </div>
      </div>

      {/* Champions Table */}
      <div className="mt-6 rounded-2xl border overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
          <div className="col-span-2">Year</div>
          <div className="col-span-4">Champion</div>
          <div className="col-span-2">Correct</div>
          <div className="col-span-4">Runner Up</div>
        </div>

        {/* Table Rows */}
        {championsSorted.map((c) => (
          <div
            key={c.year}
            className="grid grid-cols-12 px-4 py-3 border-t items-start"
          >
            <div className="col-span-2 font-mono">{c.year}</div>

            <div className="col-span-4 font-medium leading-snug">
              {c.name}
            </div>

            <div className="col-span-2 font-mono">
              {c.correct}
            </div>

            <div className="col-span-4 text-sm text-gray-700 leading-snug">
              {c.runnerUp}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Want your name here? Make your picks and climb the leaderboard.
      </p>
    </main>
  );
}
