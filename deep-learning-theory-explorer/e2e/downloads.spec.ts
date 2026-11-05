import { expect, test } from '@playwright/test';

/**
 * Downloading the numbers.
 *
 * A research laboratory that cannot hand you its data is a picture of a
 * laboratory. Every table can be downloaded, so a reader can check a claim in
 * a spreadsheet or put it in their own write-up.
 */
test.describe('downloading the numbers', () => {
  test('the self-test results can be downloaded, with what produced them', async ({ page }) => {
    await page.goto('/#/diagnostics');
    await page.getByRole('button', { name: /run the self-test/i }).click();
    await expect(page.getByText('Every check passed')).toBeVisible({ timeout: 60_000 });

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /download the results/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('self-test-results.csv');

    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString('utf8');
    // the provenance preamble, then the header, then the rows
    expect(text).toContain('# browser:');
    expect(text).toContain('# checks:');
    expect(text).toContain('check,reference,claim,measured,expected,result,time_ms');
    expect(text.split('\r\n').length).toBeGreaterThan(10);
  });

  test('the assessment can be downloaded as a study sheet', async ({ page }) => {
    await page.goto('/#/quiz');
    await expect(page.getByText('Question 1 of 20')).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /download as a study sheet/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('assessment-answers.csv');

    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString('utf8');
    expect(text).toContain('# questions: 20');
    expect(text).toContain('question,lesson,prompt,your answer,correct answer,result,explanation,sources');
    // every question is in it, and the explanation is the point
    expect(text).toContain('Wick');
  });
});
