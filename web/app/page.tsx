import { getAllRecipes, getDishCoverIds } from "@/lib/recipes-local";
import HomeList from "@/components/HomeList";

export default function Home() {
  const all = getAllRecipes();
  const covers = getDishCoverIds();
  const recipes = all.slice(0, 30).map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    author: r.author,
    excerpt: r.excerpt,
    nutrition: r.nutrition,
    price: r.price,
    difficulty: r.difficulty,
    time: r.time,
    total: r.total,
    tags: r.tags,
    hasImg: covers.has(r.id),
  }));
  return <HomeList initial={recipes} />;
}
