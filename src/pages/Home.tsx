import { useQuery } from "@tanstack/react-query";
import type { LucideProps } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  Layers3,
  Radio,
  ScanLine,
  Swords,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Entrant, Tournament } from "../shared/api/arena-api";
import { api } from "../shared/api/arena-api";
import { Badge, StatusBadge, TeamMark } from "../shared/ui/primitives";
export function Home(): React.JSX.Element {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const { data: demo } = useQuery({
    queryKey: ["featured"],
    queryFn: (): Promise<Tournament> => api.public("ARENA2026"),
    retry: false,
  });
  return (
    <main id="main-content">
      <section className="container hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> THE HOME OF YOUR NEXT RIVALRY
          </div>
          <h1>
            YOUR GAME.
            <br />
            <span>YOUR LEAGUE.</span>
          </h1>
          <p className="hero-description">
            Big rivalries start with a small group of friends.
            <br />
            Turn your squad into a league worth winning.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/new">
              Create a tournament <ArrowUpRight size={19} />
            </Link>
            <a className="text-button" href="#find">
              Join the action <ArrowRight size={17} />
            </a>
          </div>
          <div className="game-tags">
            <span>MADE FOR</span>
            <span className="game-tag">
              <span className="efootball-symbol">e</span> eFootball
            </span>
            <span className="game-tag">
              <Swords size={16} /> Call of Duty: Mobile
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-grid" />
          <div className="visual-label mono">THE COMPETITION STARTS HERE</div>
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="trophy-art">
            <svg viewBox="0 0 240 280" fill="none">
              <path
                d="M57 38h126v72c0 42-28 76-63 76s-63-34-63-76V38Z"
                fill="url(#cup)"
                stroke="#e9ff9c"
                strokeWidth="2"
              />
              <path
                d="M57 55H23v35c0 32 21 51 49 52M183 55h34v35c0 32-21 51-49 52"
                stroke="#c7ef69"
                strokeWidth="13"
              />
              <path
                d="M120 185v48M85 241h70M73 253h94"
                stroke="#c7ef69"
                strokeWidth="13"
              />
              <path
                d="m120 69 9 21 23 2-17 16 5 23-20-12-20 12 5-23-17-16 23-2 9-21Z"
                fill="#25320d"
              />
              <defs>
                <linearGradient
                  id="cup"
                  x1="57"
                  y1="38"
                  x2="182"
                  y2="186"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#e3ff97" />
                  <stop offset=".5" stopColor="#acd24b" />
                  <stop offset="1" stopColor="#719628" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="visual-ticket ticket-top">
            <span className="ticket-icon">
              <Swords size={19} />
            </span>
            <div>
              <small>ONE SQUAD. ONE GOAL.</small>
              <strong>Take the top spot.</strong>
            </div>
            <ArrowUpRight size={20} />
          </div>
          <div className="visual-ticket ticket-bottom">
            <span className="live-dot" />
            <span>Every match matters.</span>
            <span className="mono">01 — ∞</span>
          </div>
          <span className="visual-corner top">+</span>
          <span className="visual-corner bottom">+</span>
        </div>
      </section>
      <div className="marquee">
        <span>NO PLAYER ACCOUNTS</span>
        <span>✳</span>
        <span>PLAY IN ANY ORDER</span>
        <span>✳</span>
        <span>YOUR RULES, YOUR ARENA</span>
        <span>✳</span>
        <span>ONE LINK FOR EVERYONE</span>
        <span>✳</span>
      </div>
      <section className="container find-section" id="find">
        <div>
          <div className="eyebrow">SPECTATE. SUPPORT. STAY IN THE LOOP.</div>
          <h2>Got a tournament ID?</h2>
          <p>No sign-up needed. Your arena is one code away.</p>
        </div>
        <form
          className="lookup"
          onSubmit={(e: React.SubmitEvent<HTMLFormElement>): void => {
            e.preventDefault();
            if (code.trim())
              navigate(`/t/${encodeURIComponent(code.trim().toUpperCase())}`);
          }}
        >
          <label className="sr-only" htmlFor="tournament-code">
            Tournament ID
          </label>
          <input
            id="tournament-code"
            placeholder="ENTER TOURNAMENT ID"
            value={code}
            onChange={(
              e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
            ): void => setCode(e.target.value)}
            required
            maxLength={30}
          />
          <button className="button" type="submit">
            Find tournament <ArrowRight size={17} />
          </button>
        </form>
      </section>
      <section className="container features-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">LESS ORGANIZING. MORE PLAYING.</div>
            <h2>Everything your league needs.</h2>
          </div>
          <span className="mono muted">BUILT AROUND THE MATCH.</span>
        </div>
        <div className="feature-grid">
          {[
            {
              icon: Layers3,
              no: "01",
              title: "Pick your format.",
              text: "League, group + knockout, or only knockout. Build the competition your way.",
            },
            {
              icon: ScanLine,
              no: "02",
              title: "Score it in seconds.",
              text: "Enter the result or upload a scorecard. Review the suggestion, then make it official.",
            },
            {
              icon: Users,
              no: "03",
              title: "Bring the whole squad.",
              text: "Players just play. Share one link for fixtures, standings and every twist in the table.",
            },
          ].map(
            (f: {
              icon: React.ForwardRefExoticComponent<
                Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
              >;
              no: string;
              title: string;
              text: string;
            }): React.JSX.Element => (
              <article className="feature-card" key={f.no}>
                <div className="feature-top">
                  <f.icon size={25} />
                  <span className="mono">{f.no}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ),
          )}
        </div>
      </section>
      {demo && (
        <section className="container featured-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <Radio size={13} /> FROM THE ARENA
              </div>
              <h2>A league in motion.</h2>
            </div>
            <Link className="text-button" to={`/t/${demo.publicId}`}>
              Explore the demo <ArrowUpRight size={17} />
            </Link>
          </div>
          <Link className="featured-card" to={`/t/${demo.publicId}`}>
            <div>
              <StatusBadge status={demo.status} />
              <h3>{demo.name}</h3>
              <p>eFootball · Round robin · {demo.entrants.length} teams</p>
              <span className="mono">ID: {demo.publicId}</span>
            </div>
            <div className="featured-teams">
              {demo.entrants
                .slice(0, 4)
                .map((e: Entrant, i: number): React.JSX.Element => (
                  <TeamMark name={e.name} index={i} key={e.id} />
                ))}
            </div>
            <ArrowUpRight className="featured-arrow" size={28} />
          </Link>
        </section>
      )}
      <section className="container final-cta">
        <Badge kind="lime">YOUR NEXT CHAMPION IS OUT THERE</Badge>
        <h2>
          MAKE IT A<br />
          <span>PROPER RIVALRY.</span>
        </h2>
        <Link className="button" to="/new">
          Start your arena <ArrowUpRight size={20} />
        </Link>
      </section>
    </main>
  );
}
