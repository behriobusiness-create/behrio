import Link from "next/link";
import Image from "next/image";

export function Logo({
  href = "/",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="Behrio"
      className={`inline-flex items-center ${className}`}
    >
      <Image
        src="/behrio-logo.png"
        alt="Behrio"
        width={800}
        height={224}
        priority
        className="h-8 w-auto"
      />
    </Link>
  );
}