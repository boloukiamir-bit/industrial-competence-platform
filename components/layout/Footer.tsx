import { Building2, Linkedin, Twitter } from "lucide-react";
import { SiGithub } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Integrations", href: "#integrations" },
    { label: "Changelog", href: "#changelog" },
  ],
  solutions: [
    { label: "Manufacturing", href: "#manufacturing" },
    { label: "Energy", href: "#energy" },
    { label: "Construction", href: "#construction" },
    { label: "Healthcare", href: "#healthcare" },
  ],
  resources: [
    { label: "Documentation", href: "#docs" },
    { label: "Blog", href: "#blog" },
    { label: "Case Studies", href: "#cases" },
    { label: "Webinars", href: "#webinars" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary text-primary-foreground">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="font-semibold text-lg" data-testid="text-footer-logo">
                Industrial Competence
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs" data-testid="text-footer-tagline">
              Enterprise-grade competency management for industrial organizations worldwide.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild data-testid="link-social-twitter">
                <a href="#twitter" aria-label="Twitter">
                  <Twitter className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild data-testid="link-social-linkedin">
                <a href="#linkedin" aria-label="LinkedIn">
                  <Linkedin className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild data-testid="link-social-github">
                <a href="#github" aria-label="GitHub">
                  <SiGithub className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-4" data-testid="text-footer-product">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={`link-footer-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-4" data-testid="text-footer-solutions">Solutions</h3>
            <ul className="space-y-3">
              {footerLinks.solutions.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={`link-footer-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-4" data-testid="text-footer-newsletter">Newsletter</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Stay updated with the latest in competency management.
            </p>
            <form className="flex flex-col gap-2">
              <Input
                type="email"
                placeholder="Enter your email"
                className="w-full"
                data-testid="input-newsletter-email"
              />
              <Button type="submit" className="w-full" data-testid="button-newsletter-subscribe">
                Subscribe
              </Button>
            </form>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground" data-testid="text-copyright">
            2024 Industrial Competence Platform. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-privacy"
            >
              Privacy Policy
            </a>
            <a
              href="#terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-terms"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
