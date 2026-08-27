import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DepartmentWarService } from './department-war.service';

/**
 * Seed quiz questions for Department War.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register src/department-war/seed-questions.ts
 *
 * Or add to package.json scripts:
 *   "seed:war": "ts-node -r tsconfig-paths/register src/department-war/seed-questions.ts"
 */

// ── General Knowledge Questions ──
const GENERAL_QUESTIONS = [
  {
    questionText: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctIndex: 1,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the largest ocean on Earth?',
    options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
    correctIndex: 3,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Who painted the Mona Lisa?',
    options: ['Vincent van Gogh', 'Pablo Picasso', 'Leonardo da Vinci', 'Michelangelo'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What year did World War II end?',
    options: ['1943', '1944', '1945', '1946'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the chemical symbol for water?',
    options: ['H2O', 'CO2', 'NaCl', 'O2'],
    correctIndex: 0,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Which country has the largest population?',
    options: ['United States', 'India', 'China', 'Indonesia'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'medium',
  },
  {
    questionText: 'What is the speed of light in km/s (approximately)?',
    options: ['150,000', '300,000', '450,000', '600,000'],
    correctIndex: 1,
    category: 'general',
    difficulty: 'medium',
  },
  {
    questionText: 'Which element has the atomic number 79?',
    options: ['Silver', 'Platinum', 'Gold', 'Copper'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'medium',
  },
  {
    questionText: 'What is the smallest country in the world by area?',
    options: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'],
    correctIndex: 1,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Which data structure uses FIFO (First In, First Out)?',
    options: ['Stack', 'Queue', 'Tree', 'Graph'],
    correctIndex: 1,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'What does HTML stand for?',
    options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Hyper Transfer Markup Language', 'Home Tool Markup Language'],
    correctIndex: 0,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'Which sorting algorithm has the best average-case time complexity?',
    options: ['Bubble Sort', 'Merge Sort', 'Selection Sort', 'Insertion Sort'],
    correctIndex: 1,
    category: 'computer_science',
    difficulty: 'medium',
  },
  {
    questionText: 'What is the time complexity of binary search?',
    options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
    correctIndex: 1,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'Which protocol is used for secure web browsing?',
    options: ['HTTP', 'FTP', 'HTTPS', 'SMTP'],
    correctIndex: 2,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'What does CPU stand for?',
    options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Central Processor Unifier'],
    correctIndex: 0,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Which programming language is known as the "language of the web"?',
    options: ['Python', 'Java', 'JavaScript', 'C++'],
    correctIndex: 2,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the time complexity of accessing an element in an array by index?',
    options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'],
    correctIndex: 2,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'Which planet has the most moons?',
    options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    correctIndex: 1,
    category: 'general',
    difficulty: 'medium',
  },
  {
    questionText: 'What is the hardest natural substance on Earth?',
    options: ['Gold', 'Iron', 'Diamond', 'Quartz'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Who developed the theory of relativity?',
    options: ['Isaac Newton', 'Albert Einstein', 'Nikola Tesla', 'Stephen Hawking'],
    correctIndex: 1,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the main component of the Sun?',
    options: ['Helium', 'Hydrogen', 'Oxygen', 'Carbon'],
    correctIndex: 1,
    category: 'general',
    difficulty: 'medium',
  },
  {
    questionText: 'In which year did Nigeria gain independence?',
    options: ['1957', '1958', '1960', '1963'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the currency of Japan?',
    options: ['Yuan', 'Won', 'Yen', 'Ringgit'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Which gas do plants absorb from the atmosphere?',
    options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the binary representation of the decimal number 10?',
    options: ['1010', '1100', '1001', '1110'],
    correctIndex: 0,
    category: 'computer_science',
    difficulty: 'medium',
  },
  {
    questionText: 'Which of these is NOT a programming paradigm?',
    options: ['Object-Oriented', 'Functional', 'Procedural', 'Digital'],
    correctIndex: 3,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'What does SQL stand for?',
    options: ['Structured Query Language', 'Simple Query Language', 'Standard Question Language', 'System Query Logic'],
    correctIndex: 0,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'Which layer of the OSI model is responsible for routing?',
    options: ['Data Link', 'Network', 'Transport', 'Session'],
    correctIndex: 1,
    category: 'computer_science',
    difficulty: 'medium',
  },
  {
    questionText: 'What is the time complexity of quicksort in the worst case?',
    options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
    correctIndex: 2,
    category: 'computer_science',
    difficulty: 'medium',
  },
  {
    questionText: 'What is the powerhouse of the cell?',
    options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Endoplasmic Reticulum'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Which Shakespeare play features the character Hamlet?',
    options: ['Macbeth', 'Othello', 'Hamlet', 'King Lear'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the largest desert in the world?',
    options: ['Sahara', 'Gobi', 'Antarctic', 'Arabian'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'medium',
  },
  {
    questionText: 'How many bits are in a byte?',
    options: ['4', '8', '16', '32'],
    correctIndex: 1,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'What does API stand for?',
    options: ['Application Programming Interface', 'Advanced Program Integration', 'Application Process Interface', 'Advanced Programming Interface'],
    correctIndex: 0,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'Which country is known as the Land of the Rising Sun?',
    options: ['China', 'South Korea', 'Japan', 'Thailand'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the formula for calculating the area of a circle?',
    options: ['πr²', '2πr', 'πd', 'r²'],
    correctIndex: 0,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Which protocol is used for email transmission?',
    options: ['HTTP', 'FTP', 'SMTP', 'SSH'],
    correctIndex: 2,
    category: 'computer_science',
    difficulty: 'medium',
  },
  {
    questionText: 'What is the default port for HTTPS?',
    options: ['80', '443', '8080', '3000'],
    correctIndex: 1,
    category: 'computer_science',
    difficulty: 'medium',
  },
  {
    questionText: 'Which data structure is used in BFS (Breadth-First Search)?',
    options: ['Stack', 'Queue', 'Tree', 'Heap'],
    correctIndex: 1,
    category: 'computer_science',
    difficulty: 'medium',
  },
  {
    questionText: 'What is the chemical formula for table salt?',
    options: ['KCl', 'NaCl', 'CaCl2', 'MgCl2'],
    correctIndex: 1,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'Who wrote "Romeo and Juliet"?',
    options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'],
    correctIndex: 1,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the largest planet in our solar system?',
    options: ['Saturn', 'Neptune', 'Jupiter', 'Uranus'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'In which continent is Nigeria located?',
    options: ['Asia', 'Europe', 'Africa', 'South America'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What does RAM stand for?',
    options: ['Random Access Memory', 'Read Access Memory', 'Run All Memory', 'Rapid Access Module'],
    correctIndex: 0,
    category: 'computer_science',
    difficulty: 'easy',
  },
  {
    questionText: 'Which social media platform was founded by Mark Zuckerberg?',
    options: ['Twitter', 'Instagram', 'Facebook', 'Snapchat'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'easy',
  },
  {
    questionText: 'What is the primary function of a compiler?',
    options: ['Run code', 'Translate code', 'Debug code', 'Store code'],
    correctIndex: 1,
    category: 'computer_science',
    difficulty: 'medium',
  },
  {
    questionText: 'Which of these is a NoSQL database?',
    options: ['MySQL', 'PostgreSQL', 'MongoDB', 'Oracle'],
    correctIndex: 2,
    category: 'computer_science',
    difficulty: 'medium',
  },
  {
    questionText: 'What is the capital of South Africa?',
    options: ['Johannesburg', 'Cape Town', 'Pretoria', 'Durban'],
    correctIndex: 2,
    category: 'general',
    difficulty: 'medium',
  },
  {
    questionText: 'What does CSS stand for?',
    options: ['Cascading Style Sheets', 'Computer Style Sheets', 'Creative Style System', 'Colorful Style Sheets'],
    correctIndex: 0,
    category: 'computer_science',
    difficulty: 'easy',
  },
];

// ── Run seed ──
async function seed() {
  console.log('🌱 Seeding Department War questions...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const warService = app.get(DepartmentWarService);

  let created = 0;
  for (const q of GENERAL_QUESTIONS) {
    try {
      await warService.seedQuestion(
        q.questionText,
        q.options,
        q.correctIndex,
        undefined, // departmentId — null = general question
        q.category,
        q.difficulty,
      );
      created++;
      process.stdout.write('.');
    } catch (err: any) {
      // Skip duplicates
      if (err.message?.includes('duplicate') || err.message?.includes('already exists')) {
        process.stdout.write('x');
      } else {
        console.error(`\n❌ Failed to seed: "${q.questionText}" — ${err.message}`);
      }
    }
  }

  console.log(`\n\n✅ Done! Created ${created} questions out of ${GENERAL_QUESTIONS.length} total.`);
  console.log(`   (${GENERAL_QUESTIONS.length - created} skipped — duplicates)\n`);

  await app.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
