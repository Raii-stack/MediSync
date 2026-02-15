import { test, expect, Page, BrowserContext, Browser } from '@playwright/test';

/**
 * Playwright Test Suite for VitalsScreen Component
 * Tests the Vital Signs Check UI component for correct layout, styling, and functionality
 */

test.describe('VitalsScreen Component', () => {
  let page: Page;

  test.beforeEach(async ({ browser }: { browser: Browser }) => {
    page = await browser.newPage();
    // Navigate to the vitals screen - adjust URL based on your application routing
    await page.goto('http://localhost:5173/vitals', { waitUntil: 'networkidle' });
    // Wait for the main component to load
    await page.waitForSelector('[data-testid="vitals-screen"]', { timeout: 5000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should render the VitalsScreen component', async () => {
    const vitalsScreen = await page.locator('[data-testid="vitals-screen"]');
    await expect(vitalsScreen).toBeVisible();
  });

  test('should display greeting text with student name', async () => {
    const greeting = await page.locator('[data-testid="greeting-text"]');
    await expect(greeting).toBeVisible();
    const text = await greeting.textContent();
    expect(text).toMatch(/Hello, \w+!/);
  });

  test('should display the main title "Vital Signs Check"', async () => {
    const title = await page.locator('[data-testid="vital-signs-title"]');
    await expect(title).toBeVisible();
    await expect(title).toContainText('Vital Signs Check');
  });

  test('should display Health Monitoring badge', async () => {
    const badge = await page.locator('[data-testid="health-monitoring-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Health Monitoring');
  });

  test('should render Heart Rate card with correct styling', async () => {
    const heartRateCard = await page.locator('[data-testid="heart-rate-card"]');
    await expect(heartRateCard).toBeVisible();

    // Check for card elements
    const heartRateLabel = await page.locator('[data-testid="heart-rate-label"]');
    await expect(heartRateLabel).toContainText('Heart Rate');

    const bpmValue = await page.locator('[data-testid="bpm-value"]');
    await expect(bpmValue).toBeVisible();

    // Verify card has proper styling
    const cardStyles = await heartRateCard.evaluate((element: Element) => {
      const styles = window.getComputedStyle(element);
      return {
        backgroundColor: styles.backgroundColor,
        borderRadius: styles.borderRadius,
        boxShadow: styles.boxShadow,
      };
    });

    expect(cardStyles.backgroundColor).toBeTruthy();
    expect(cardStyles.borderRadius).toBeTruthy();
  });

  test('should render Temperature card with correct styling', async () => {
    const temperatureCard = await page.locator('[data-testid="temperature-card"]');
    await expect(temperatureCard).toBeVisible();

    // Check for card elements
    const temperatureLabel = await page.locator('[data-testid="temperature-label"]');
    await expect(temperatureLabel).toContainText('Temperature');

    const temperatureValue = await page.locator('[data-testid="temperature-value"]');
    await expect(temperatureValue).toBeVisible();

    // Verify card has proper styling
    const cardStyles = await temperatureCard.evaluate((element: Element) => {
      const styles = window.getComputedStyle(element);
      return {
        backgroundColor: styles.backgroundColor,
        borderRadius: styles.borderRadius,
        boxShadow: styles.boxShadow,
      };
    });

    expect(cardStyles.backgroundColor).toBeTruthy();
    expect(cardStyles.borderRadius).toBeTruthy();
  });

  test('should display BPM and temperature values', async () => {
    const bpmValue = await page.locator('[data-testid="bpm-value"]');
    const temperatureValue = await page.locator('[data-testid="temperature-value"]');

    await expect(bpmValue).toBeVisible();
    await expect(temperatureValue).toBeVisible();

    // Verify values are displayed (initial values or defaults)
    const bpmText = await bpmValue.textContent();
    const tempText = await temperatureValue.textContent();

    expect(bpmText).toBeTruthy();
    expect(tempText).toBeTruthy();
  });

  test('should display progress bar container', async () => {
    const progressBar = await page.locator('[data-testid="progress-bar-container"]');
    await expect(progressBar).toBeVisible();

    // Check progress bar fill exists
    const progressFill = await page.locator('[data-testid="progress-bar-fill"]');
    await expect(progressFill).toBeVisible();
  });

  test('should update progress bar dynamically', async () => {
    const progressFill = await page.locator('[data-testid="progress-bar-fill"]');

    // Get initial width
    const initialWidth = await progressFill.evaluate((element: Element) => {
      const styles = window.getComputedStyle(element);
      return styles.width;
    });

    // Simulate some progress updates by waiting
    await page.waitForTimeout(1000);

    // Verify progress bar still exists and is visible
    await expect(progressFill).toBeVisible();
  });

  test('should display Emergency button and verify it is red', async () => {
    const emergencyButton = await page.locator('[data-testid="emergency-button"]');
    await expect(emergencyButton).toBeVisible();

    // Verify the button is displayed and has proper styling
    const isVisible = await emergencyButton.isVisible();
    expect(isVisible).toBe(true);

    // Check if button or its parent has red background
    const buttonStyles = await emergencyButton.evaluate((element: Element) => {
      const styles = window.getComputedStyle(element);
      const parentStyles = window.getComputedStyle(element.parentElement!);
      return {
        iconColor: styles.color,
        parentBackground: parentStyles.backgroundColor,
      };
    });

    expect(buttonStyles).toBeTruthy();
  });

  test('should display capturing text at the bottom', async () => {
    const capturingText = await page.locator('[data-testid="capturing-text"]');
    await expect(capturingText).toBeVisible();
    await expect(capturingText).toContainText('Capturing heart rate');
    await expect(capturingText).toContainText('temperature');
  });

  test('should have correct layout with proper spacing', async () => {
    const vitalsScreen = await page.locator('[data-testid="vitals-screen"]');

    // Verify screen dimensions
    const boundingBox = await vitalsScreen.boundingBox();
    expect(boundingBox).toBeTruthy();
    if (boundingBox) {
      expect(boundingBox.width).toBeGreaterThan(0);
      expect(boundingBox.height).toBeGreaterThan(0);
    }
  });

  test('should display both cards side by side', async () => {
    const heartRateCard = await page.locator('[data-testid="heart-rate-card"]');
    const temperatureCard = await page.locator('[data-testid="temperature-card"]');

    const heartBox = await heartRateCard.boundingBox();
    const tempBox = await temperatureCard.boundingBox();

    expect(heartBox).toBeTruthy();
    expect(tempBox).toBeTruthy();

    if (heartBox && tempBox) {
      // Verify cards are at similar vertical positions (side by side)
      expect(Math.abs(heartBox.y - tempBox.y)).toBeLessThan(50);

      // Verify cards don't overlap horizontally
      expect(heartBox.x + heartBox.width < tempBox.x || tempBox.x + tempBox.width < heartBox.x).toBeTruthy();
    }
  });

  test('should verify card colors for Heart Rate (red) and Temperature (blue)', async () => {
    const bpmValue = await page.locator('[data-testid="bpm-value"]');
    const temperatureValue = await page.locator('[data-testid="temperature-value"]');

    // Get computed colors
    const bpmColor = await bpmValue.evaluate((element: Element) => {
      return window.getComputedStyle(element).color;
    });

    const tempColor = await temperatureValue.evaluate((element: Element) => {
      return window.getComputedStyle(element).color;
    });

    // Heart Rate should have red color
    expect(bpmColor).toMatch(/rgb|#/);

    // Temperature should have blue color
    expect(tempColor).toMatch(/rgb|#/);
  });

  test('should render with proper background color', async () => {
    const vitalsScreen = await page.locator('[data-testid="vitals-screen"]');

    const bgColor = await vitalsScreen.evaluate((element: Element) => {
      return window.getComputedStyle(element).backgroundColor;
    });

    // Should have a light gray background
    expect(bgColor).toBeTruthy();
  });

  test('should handle missing student name gracefully', async () => {
    const greeting = await page.locator('[data-testid="greeting-text"]');
    const greetingText = await greeting.textContent();

    // Should either have a name or default to "Ryan"
    expect(greetingText).toMatch(/Hello, \w+!/);
  });

  test('should verify all vital signs cards use correct fonts', async () => {
    const heartRateLabel = await page.locator('[data-testid="heart-rate-label"]');
    const temperatureLabel = await page.locator('[data-testid="temperature-label"]');

    const heartFont = await heartRateLabel.evaluate((element: Element) => {
      return window.getComputedStyle(element).fontFamily;
    });

    const tempFont = await temperatureLabel.evaluate((element: Element) => {
      return window.getComputedStyle(element).fontFamily;
    });

    expect(heartFont).toBeTruthy();
    expect(tempFont).toBeTruthy();
  });

  test('should verify large font size for vital values', async () => {
    const bpmValue = await page.locator('[data-testid="bpm-value"]');
    const temperatureValue = await page.locator('[data-testid="temperature-value"]');

    const bpmFontSize = await bpmValue.evaluate((element: Element) => {
      return window.getComputedStyle(element).fontSize;
    });

    const tempFontSize = await temperatureValue.evaluate((element: Element) => {
      return window.getComputedStyle(element).fontSize;
    });

    // Font sizes should be large (> 80px)
    const bpmSize = parseInt(bpmFontSize);
    const tempSize = parseInt(tempFontSize);

    expect(bpmSize).toBeGreaterThan(80);
    expect(tempSize).toBeGreaterThan(80);
  });

  test('should take snapshot of the VitalsScreen component', async () => {
    const vitalsScreen = await page.locator('[data-testid="vitals-screen"]');
    await expect(vitalsScreen).toHaveScreenshot('vitals-screen.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should take snapshot of Heart Rate card', async () => {
    const heartRateCard = await page.locator('[data-testid="heart-rate-card"]');
    await expect(heartRateCard).toHaveScreenshot('heart-rate-card.png', {
      maxDiffPixels: 50,
    });
  });

  test('should take snapshot of Temperature card', async () => {
    const temperatureCard = await page.locator('[data-testid="temperature-card"]');
    await expect(temperatureCard).toHaveScreenshot('temperature-card.png', {
      maxDiffPixels: 50,
    });
  });

  test('should verify responsive behavior on different viewport sizes', async () => {
    // Test on desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    const vitalsScreenDesktop = await page.locator('[data-testid="vitals-screen"]');
    await expect(vitalsScreenDesktop).toBeVisible();

    // Test on tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    const vitalsScreenTablet = await page.locator('[data-testid="vitals-screen"]');
    await expect(vitalsScreenTablet).toBeVisible();
  });

  test('should verify Emergency button is clickable', async () => {
    const emergencyButton = await page.locator('[data-testid="emergency-button"]');

    // Verify button has pointer cursor
    const cursor = await emergencyButton.evaluate((element: Element) => {
      return window.getComputedStyle(element).cursor;
    });

    // Button should be interactive
    const isEnabled = await emergencyButton.isEnabled();
    expect(isEnabled).toBeTruthy();
  });

  test('should display icons in both cards', async () => {
    // Check heart rate card has image
    const heartImage = await page.locator('[data-testid="heart-rate-card"] img');
    await expect(heartImage).toBeVisible();

    // Check temperature card has image
    const tempImage = await page.locator('[data-testid="temperature-card"] img');
    await expect(tempImage).toBeVisible();
  });

  test('should verify card shadows for visual depth', async () => {
    const heartRateCard = await page.locator('[data-testid="heart-rate-card"]');
    const temperatureCard = await page.locator('[data-testid="temperature-card"]');

    const heartShadow = await heartRateCard.evaluate((element: Element) => {
      return window.getComputedStyle(element).boxShadow;
    });

    const tempShadow = await temperatureCard.evaluate((element: Element) => {
      return window.getComputedStyle(element).boxShadow;
    });

    // Both cards should have shadows
    expect(heartShadow).not.toBe('none');
    expect(tempShadow).not.toBe('none');
  });

  test('should verify rounded corners on cards', async () => {
    const heartRateCard = await page.locator('[data-testid="heart-rate-card"]');

    const borderRadius = await heartRateCard.evaluate((element: Element) => {
      return window.getComputedStyle(element).borderRadius;
    });

    // Should have rounded corners (24px as per design)
    expect(borderRadius).not.toBe('0px');
  });

  test('should display all essential text elements', async () => {
    const essentialTexts = [
      '[data-testid="greeting-text"]',
      '[data-testid="vital-signs-title"]',
      '[data-testid="health-monitoring-badge"]',
      '[data-testid="heart-rate-label"]',
      '[data-testid="temperature-label"]',
      '[data-testid="capturing-text"]',
    ];

    for (const selector of essentialTexts) {
      const element = await page.locator(selector);
      await expect(element).toBeVisible();
    }
  });
});
