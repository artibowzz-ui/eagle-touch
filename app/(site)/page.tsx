import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { PhotoBand } from "@/components/PhotoBand";
import { ScoreSection } from "@/components/ScoreSection";
import { Statement } from "@/components/Statement";
import { AverageSection } from "@/components/AverageSection";
import { SeasonTimeline } from "@/components/SeasonTimeline";
import { Challenges } from "@/components/Challenges";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <PhotoBand />
        <ScoreSection />
        <Statement />
        <AverageSection />
        <SeasonTimeline />
        <Challenges />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
