import * as fs from 'fs-extra';
import * as path from 'path';
import inquirer from 'inquirer';
import { getRecentMoves } from '../infrastructure/database';

export async function handleRevert(count?: number) {
  console.log('🔄 Reverting last file moves...\n');

  const moves = getRecentMoves();
  if (moves.length === 0) {
    console.log('No moves to revert.');
    return;
  }

  console.log('Recent moves:');
  console.table(moves.map(m => ({
    'From': path.basename(m.original_path),
    'To': path.basename(m.new_path),
    'Time': m.timestamp
  })));

  if (!count) {
    const answer = await inquirer.prompt({
      type: 'number',
      name: 'count',
      message: 'How many moves to revert?',
      default: moves.length
    });
    count = answer.count;
  }

  const movesToRevert = moves.slice(0, count);

  for (const move of movesToRevert) {
    try {
      await fs.move(move.new_path, move.original_path, { overwrite: true });
      console.log(`Reverted: ${path.basename(move.new_path)} -> ${path.basename(move.original_path)}`);
    } catch (error) {
      console.error(`Failed to revert ${move.new_path}:`, error);
    }
  }

  console.log('\n✅ Revert complete.');
}