import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// @public – automatisierte Accessibility-Prüfung (axe-core) auf öffentlichen Seiten.
// Ersetzt KEINE manuelle Tastatur-/Screenreader-Prüfung (siehe RELEASE_CHECKLISTE.md).
test.describe("@public Accessibility (axe-core)", () => {
  for (const path of ["/login", "/offline"]) {
    test(`keine kritischen a11y-Verstöße: ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(serious.map((v) => v.id)).toEqual([]);
    });
  }
});
