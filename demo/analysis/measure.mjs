/**
 * Measure candidate sentences so a post can be tuned to the character budget
 * without counting by hand.
 *
 *   node analysis/measure.mjs "first line" "second line"
 */
const lines = process.argv.slice(2);
for (const l of lines) console.log(`  ${String([...l].length).padStart(3)}  ${l}`);