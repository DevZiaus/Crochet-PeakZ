import Link from "next/link";
import { Container } from "@/components/container";

/** Styled storefront not found page. */
export default function StorefrontNotFound() {
  return (
    <Container className="py-20 sm:py-28">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-semibold tracking-wide text-highlight uppercase">
          404
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">
          This piece could not be found
        </h1>
        <p className="mt-4 text-muted-foreground">
          It may have sold out or moved. The rest of the shop is still here.
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary-hover motion-reduce:transition-none"
        >
          Back to shop
        </Link>
      </div>
    </Container>
  );
}
