
import { parseTaskHint } from './Tazq-Frontend/utils/taskParser';

const test1 = parseTaskHint("Yarın spor yap");
console.log("Test 1 (Yarın):", test1.dueDate);

const test2 = parseTaskHint("Yarı spor yap");
console.log("Test 2 (Yarı):", test2.dueDate);

const test3 = parseTaskHint("Acil iş");
console.log("Test 3 (Acil):", test3.priority);

const test4 = parseTaskHint("İş");
console.log("Test 4 (İş):", test4.priority);
