import { Link } from "react-router-dom";
import { Layout } from "../components/ui";
export function NotFoundPage() {
  return (
    <Layout dark>
      <section className="not-found container">
        <span className="eyebrow">404 · PAGE NOT FOUND</span>
        <h1>This page has wandered off.</h1>
        <p>The story may have moved, become private, or never existed.</p>
        <div>
          <Link className="button" to="/">
            Return home
          </Link>
          <Link to="/blog">Explore stories →</Link>
        </div>
      </section>
    </Layout>
  );
}
