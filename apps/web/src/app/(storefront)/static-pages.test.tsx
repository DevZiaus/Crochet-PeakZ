import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage, {
  generateMetadata as generateAboutMetadata,
} from "./about/page";
import ContactPage, {
  generateMetadata as generateContactMetadata,
} from "./contact/page";
import DataDeletionPage, {
  generateMetadata as generateDataDeletionMetadata,
} from "./data-deletion/page";
import PrivacyPage, {
  generateMetadata as generatePrivacyMetadata,
} from "./privacy/page";

vi.mock("../../lib/catalog/env", () => ({
  getCatalogEnv: () => ({
    webAppUrl: "https://shop.example.test",
    apiInternalUrl: "http://api.test/api",
  }),
}));

describe("Storefront info and legal pages", () => {
  it("renders the About page with one h1, studio values, and canonical metadata", () => {
    const metadata = generateAboutMetadata();
    expect(metadata.alternates?.canonical).toBe(
      "https://shop.example.test/about",
    );

    render(<AboutPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Warmth over perfection/)).toBeInTheDocument();
    expect(screen.getByText(/Curiosity in every loop/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Explore the shop/ }),
    ).toHaveAttribute("href", "/shop");
    expect(screen.getByRole("link", { name: "Get in touch" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("renders the Contact page with Crochet PeakZ email, social links, and form", async () => {
    const metadata = generateContactMetadata();
    expect(metadata.alternates?.canonical).toBe(
      "https://shop.example.test/contact",
    );

    render(await ContactPage());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: /hello@crochetpeakz\.tech/ }),
    ).toHaveAttribute("href", "mailto:hello@crochetpeakz.tech");

    const facebookLink = screen.getByRole("link", {
      name: /Facebook \/ crochet\.peakz/,
    });
    expect(facebookLink).toHaveAttribute(
      "href",
      "https://www.facebook.com/crochet.peakz",
    );
    expect(facebookLink).toHaveAttribute("rel", "noopener noreferrer");

    const instagramLink = screen.getByRole("link", {
      name: /Instagram \/ crochetpeakz/,
    });
    expect(instagramLink).toHaveAttribute(
      "href",
      "https://www.instagram.com/crochetpeakz/",
    );
    expect(instagramLink).toHaveAttribute("rel", "noopener noreferrer");

    expect(
      screen.getByRole("heading", { name: "Send us a note" }),
    ).toBeInTheDocument();
  });

  it("pre-selects the contact topic from ?topic= and falls back on unknown topics", async () => {
    const { unmount } = render(
      await ContactPage({
        searchParams: Promise.resolve({ topic: "data-deletion" }),
      }),
    );

    expect(screen.getByRole("combobox", { name: /Topic/ })).toHaveTextContent(
      "Data deletion",
    );

    unmount();

    render(
      await ContactPage({
        searchParams: Promise.resolve({ topic: "invalid-topic" }),
      }),
    );

    expect(screen.getByRole("combobox", { name: /Topic/ })).toHaveTextContent(
      "General inquiry",
    );
  });

  it("renders the Privacy page with hello@crochetpeakz.tech and link to data deletion", () => {
    const metadata = generatePrivacyMetadata();
    expect(metadata.alternates?.canonical).toBe(
      "https://shop.example.test/privacy",
    );

    render(<PrivacyPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "hello@crochetpeakz.tech" }),
    ).toHaveAttribute("href", "mailto:hello@crochetpeakz.tech");
    expect(
      screen.getByRole("link", { name: /data deletion instructions/i }),
    ).toHaveAttribute("href", "/data-deletion");
  });

  it("renders the Data Deletion page with mailto request link and link back to privacy", () => {
    const metadata = generateDataDeletionMetadata();
    expect(metadata.alternates?.canonical).toBe(
      "https://shop.example.test/data-deletion",
    );

    render(<DataDeletionPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "contact form" })).toHaveAttribute(
      "href",
      "/contact?topic=data-deletion",
    );
    expect(screen.getByText("Data deletion")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "hello@crochetpeakz.tech" }),
    ).toHaveAttribute(
      "href",
      "mailto:hello@crochetpeakz.tech?subject=Data%20deletion%20request",
    );
    expect(
      screen.getByRole("link", { name: /privacy policy/i }),
    ).toHaveAttribute("href", "/privacy");
  });
});
