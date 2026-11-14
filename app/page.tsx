import { About } from "@/components/home/about";
import { BlogPreview } from "@/components/home/blog-preview";
import { Contact } from "@/components/home/contact";
import { Hero } from "@/components/home/hero";
import { Services } from "@/components/home/services";

export default function Home() {
  return (
    <main>
      <Hero />
      <About />
      <Services />
      <BlogPreview />
      <Contact />
    </main>
  );
}
