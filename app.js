/* =========================================================
   QUESTION DATABASE
========================================================= */

let questions =
JSON.parse(localStorage.getItem("quizQuestions")) || [

{
subject:"Computer Science",
difficulty:"easy",
question:"What does HTML stand for?",
options:[
"Hyper Text Markup Language",
"High Tech Modern Language",
"Hyperlink Text Management Language",
"Home Tool Markup Language"
],
answer:0
},

{
subject:"Computer Science",
difficulty:"medium",
question:"Which language is mainly used to style web pages?",
options:[
"HTML",
"CSS",
"Python",
"SQL"
],
answer:1
},

{
subject:"Computer Science",
difficulty:"medium",
question:"Which language adds interactivity to web pages?",
options:[
"CSS",
"HTML",
"JavaScript",
"SQL"
],
answer:2
},

{
subject:"Computer Science",
difficulty:"easy",
question:"What does CPU stand for?",
options:[
"Central Processing Unit",
"Computer Personal Unit",
"Central Program Utility",
"Control Processing User"
],
answer:0
},

{
subject:"General Knowledge",
difficulty:"easy",
question:"What is the capital of Pakistan?",
options:[
"Lahore",
"Karachi",
"Islamabad",
"Peshawar"
],
answer:2
},

{
subject:"General Knowledge",
difficulty:"easy",
question:"Which planet is known as the Red Planet?",
options:[
"Earth",
"Mars",
"Jupiter",
"Venus"
],
answer:1
},

{
subject:"General Knowledge",
difficulty:"easy",
question:"How many continents are there?",
options:[
"5",
"6",
"7",
"8"
],
answer:2
},

{
subject:"General Knowledge",
difficulty:"medium",
question:"Which is the largest ocean on Earth?",
options:[
"Atlantic Ocean",
"Indian Ocean",
"Pacific Ocean",
"Arctic Ocean"
],
answer:2
},

{
subject:"Science",
difficulty:"easy",
question:"What gas do humans need to breathe?",
options:[
"Oxygen",
"Carbon dioxide",
"Hydrogen",
"Nitrogen"
],
answer:0
},

{
subject:"Science",
difficulty:"easy",
question:"What is H2O commonly known as?",
options:[
"Salt",
"Water",
"Oxygen",
"Hydrogen"
],
answer:1
}

];

/* =========================================================
   NORMALIZE OLD QUESTIONS
========================================================= */

questions = questions.map(q => ({
...q,
difficulty:q.difficulty || "medium"
}));

localStorage.setItem(
"quizQuestions",
JSON.stringify(questions)
);

/* =========================================================
   PLAYER DATA
========================================================= */

let statsData =
JSON.parse(localStorage.getItem("quizStats")) || {
quizzes:0,
totalScore:0,
best:0,
xp:0,
streak:0
};

let leaderboardData =
JSON.parse(localStorage.getItem("leaderboardData")) || [];

/* =========================================================
   QUIZ VARIABLES
========================================================= */

let quizData=[];
let currentQuestion=0;
let score=0;
let timerInterval=null;
let timeLeft=60;
let answered=false;
let selectedAnswer=null;

/* =========================================================
   LEVEL SYSTEM
========================================================= */

function getLevel(xp){
return Math.floor(xp/100)+1;
}

function getRank(level){
if(level>=10) return "👑 Quiz Legend";
if(level>=7) return "💎 Quiz Master";
if(level>=5) return "🔥 Quiz Expert";
if(level>=3) return "⚡ Quiz Challenger";
if(level>=2) return "📚 Quiz Learner";
return "🌱 Quiz Beginner";
}

function getLevelProgress(xp){
return xp%100;
}

function getXPToNextLevel(xp){
return 100-(xp%100);
}

/* =========================================================
   BADGES
========================================================= */

function getBadges(){
let badges=[];
if(statsData.quizzes>=1) badges.push("🎯 First Quiz");
if(statsData.quizzes>=3) badges.push("🎮 Quiz Starter");
if(statsData.quizzes>=5) badges.push("🔥 Quiz Explorer");
if(statsData.quizzes>=10) badges.push("🚀 Quiz Addict");
if(statsData.best>=80) badges.push("🌟 High Achiever");
if(statsData.best===100) badges.push("🏆 Perfect Score");
if(statsData.xp>=100) badges.push("⚡ 100 XP Club");
if(statsData.xp>=500) badges.push("💎 500 XP Club");
if(statsData.streak>=5) badges.push("🔥 5 Quiz Streak");
if(statsData.streak>=10) badges.push("👑 10 Quiz Streak");
return badges;
}

/* =========================================================
   SCREEN SYSTEM
========================================================= */

function showScreen(id){
document.querySelectorAll(".screen").forEach(screen=>{
screen.classList.remove("active");
});

const target=document.getElementById(id);
if(!target){
console.error("Screen not found:",id);
return;
}

target.classList.add("active");

if(id==="homeScreen") updateHome();

if(id==="studentScreen"){
loadSubjects();
const savedSubject = localStorage.getItem("quizMasterSelectedSubject");
if(savedSubject){
const select = document.getElementById("subjectSelect");
if([...select.options].some(o=>o.value===savedSubject)){
select.value=savedSubject;
}
}
}

if(id==="teacherScreen") displayTeacherQuestions();
if(id==="analyticsScreen") displayAnalytics();

window.scrollTo({ top:0, behavior:"smooth" });
}

/* =========================================================
   NAVIGATION
========================================================= */

function qmActive(btn){
document.querySelectorAll(".qm-nav button").forEach(b=>b.classList.remove("active"));
if(btn) btn.classList.add("active");
}

function qmGo(id,btn){
showScreen(id);
qmActive(btn);
}

function qmGoAI(btn){
document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
document.getElementById("aiQuizSection").scrollIntoView({ behavior:"smooth", block:"start" });
qmActive(btn);
}

function qmGoBadges(btn){
document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
document.getElementById("badgesBox").scrollIntoView({ behavior:"smooth", block:"start" });
qmActive(btn);
}

/* =========================================================
   SUBJECTS
========================================================= */

function loadSubjects(){
const select = document.getElementById("subjectSelect");
const subjects = [...new Set(questions.map(q=>q.subject))];
select.innerHTML="";
subjects.forEach(subject=>{
const option = document.createElement("option");
option.value = subject;
option.textContent = subject;
select.appendChild(option);
});
}

/* =========================================================
   HOME SUBJECT CARDS
========================================================= */

function renderHomeSubjects(){
const grid = document.getElementById("homeSubjects");
if(!grid) return;

const subjects = [...new Set(questions.map(q=>q.subject))];
grid.innerHTML="";

subjects.forEach(subject=>{
const count = questions.filter(q=>q.subject===subject).length;
const card = document.createElement("div");
card.className="qm-subject";

card.onclick=function(){
localStorage.setItem("quizMasterSelectedSubject", subject);
showScreen("studentScreen");
};

let icon="◇";
const s=subject.toLowerCase();
if(s.includes("computer")) icon="⌘";
else if(s.includes("science")) icon="◈";
else if(s.includes("math")) icon="∑";
else if(s.includes("english")) icon="Aa";
else if(s.includes("urdu")) icon="ا";
else if(s.includes("general")) icon="✦";

card.innerHTML=`
<div class="qm-subject-icon">${icon}</div>
<div class="qm-subject-name">${escapeHTML(subject)}</div>
<div class="qm-subject-count">${count} question${count===1?"":"s"} available</div>
`;
grid.appendChild(card);
});
}

/* =========================================================
   START QUIZ
========================================================= */

function startQuiz(){
const name = document.getElementById("studentName").value.trim();

if(!name){
showToast("Please enter your name first!", "warning");
return;
}

const subject = document.getElementById("subjectSelect").value;
const difficulty = document.getElementById("difficultySelect").value;
const count = parseInt(document.getElementById("questionCount").value);
const time = parseInt(document.getElementById("timeLimit").value);

let available = questions.filter(q =>
q.subject === subject && (q.difficulty || "medium") === difficulty
);

if(available.length === 0){
available = questions.filter(q => q.subject === subject);
}

if(available.length === 0){
showToast("No questions available for this subject.", "error");
return;
}

quizData = [...available]
.sort(() => Math.random() - 0.5)
.slice(0, Math.min(count, available.length));

currentQuestion = 0;
score = 0;
answered = false;
selectedAnswer = null;
timeLeft = time;

localStorage.setItem("quizMasterPlayerName", name);

document.getElementById("quizTitle").textContent =
subject + " • " + difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + " Quiz";

document.getElementById("totalQuestions").textContent = quizData.length;

showScreen("quizScreen");
displayQuestion();
startTimer();
}

/* =========================================================
   DISPLAY QUESTION
========================================================= */

function displayQuestion(){
if(!quizData.length) return;

const q = quizData[currentQuestion];
answered = false;
selectedAnswer = null;

document.getElementById("currentNumber").textContent = currentQuestion + 1;
document.getElementById("totalQuestions").textContent = quizData.length;
document.getElementById("questionText").textContent = q.question;

const progress = ((currentQuestion + 1) / quizData.length) * 100;
document.getElementById("progressBar").style.width = progress + "%";

const optionsBox = document.getElementById("options");
optionsBox.innerHTML = "";

q.options.forEach((option, index) => {
const button = document.createElement("button");
button.className = "option";
button.textContent = String.fromCharCode(65 + index) + ". " + option;
button.onclick = function(){ selectAnswer(index, button); };
optionsBox.appendChild(button);
});

document.getElementById("nextButton").textContent =
currentQuestion === quizData.length - 1 ? "Finish Quiz 🏆" : "Next ➡️";
}

/* =========================================================
   SELECT ANSWER
========================================================= */

function selectAnswer(index, button){
if(answered) return;
selectedAnswer = index;
document.querySelectorAll("#options .option").forEach(b => b.classList.remove("selected"));
button.classList.add("selected");
}

/* =========================================================
   NEXT QUESTION
========================================================= */

function nextQuestion(){
if(selectedAnswer === null){
showToast("Please select an answer first.", "warning");
return;
}

const q = quizData[currentQuestion];

if(selectedAnswer === q.answer){
score++;
}

if(currentQuestion >= quizData.length - 1){
finishQuiz();
return;
}

currentQuestion++;
displayQuestion();
}

/* =========================================================
   TIMER
========================================================= */

function startTimer(){
clearInterval(timerInterval);
updateTimerDisplay();

timerInterval = setInterval(() => {
timeLeft--;
updateTimerDisplay();

if(timeLeft <= 0){
clearInterval(timerInterval);
showToast("Time is up!", "warning");
finishQuiz(true);
}
}, 1000);
}

function updateTimerDisplay(){
const minutes = Math.floor(timeLeft / 60);
const seconds = timeLeft % 60;
document.getElementById("timer").textContent =
String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

/* =========================================================
   FINISH QUIZ
========================================================= */

function finishQuiz(timeUp = false){
clearInterval(timerInterval);
if(!quizData.length) return;

const total = quizData.length;
const wrong = total - score;
const percentage = Math.round((score / total) * 100);
const xpEarned = score * 10;

statsData.quizzes++;
statsData.totalScore += percentage;
if(percentage > statsData.best) statsData.best = percentage;
statsData.xp += xpEarned;
statsData.streak++;

localStorage.setItem("quizStats", JSON.stringify(statsData));

const name = localStorage.getItem("quizMasterPlayerName") || "Student";
const level = getLevel(statsData.xp);
const rank = getRank(level);

leaderboardData.push({
name: name,
score: percentage,
xp: xpEarned,
level: level,
rank: rank
});

leaderboardData.sort((a, b) => b.score - a.score);
leaderboardData = leaderboardData.slice(0, 20);
localStorage.setItem("leaderboardData", JSON.stringify(leaderboardData));

document.getElementById("resultScore").textContent = percentage + "%";
document.getElementById("correctResult").textContent = score;
document.getElementById("wrongResult").textContent = wrong;
document.getElementById("xpResult").textContent = xpEarned;
document.getElementById("resultTotalXP").textContent = statsData.xp;
document.getElementById("resultLevel").textContent = "Level " + level;
document.getElementById("resultRank").textContent = rank;

document.getElementById("resultDetails").textContent =
`You answered ${score} out of ${total} questions correctly.` +
(timeUp ? " The quiz ended because the time limit was reached." : "");

let message = "";
if(percentage === 100) message = "Perfect score! Outstanding work! 🏆";
else if(percentage >= 80) message = "Excellent work! Keep going! 🌟";
else if(percentage >= 60) message = "Good job! A little more practice will make you stronger. 📚";
else message = "Keep practicing — every quiz helps you improve! 💪";

document.getElementById("resultMessage").textContent = message;

const badges = getBadges();
document.getElementById("resultBadges").innerHTML = badges.length
? badges.map(b => `<span class="badge">${escapeHTML(b)}</span>`).join("")
: "No badges yet.";

showScreen("resultScreen");
updateHome();
renderBadges();
}

/* =========================================================
   TEACHER QUESTIONS
========================================================= */

function saveQuestion(){
const subject = document.getElementById("teacherSubject").value.trim();
const difficulty = document.getElementById("teacherDifficulty").value;
const question = document.getElementById("questionInput").value.trim();
const options = [
document.getElementById("optionA").value.trim(),
document.getElementById("optionB").value.trim(),
document.getElementById("optionC").value.trim(),
document.getElementById("optionD").value.trim()
];
const answer = parseInt(document.getElementById("correctInput").value);

if(!subject || !question || options.some(o => !o)){
showToast("Please complete all fields.", "warning");
return;
}

questions.push({ subject, difficulty, question, options, answer });
localStorage.setItem("quizQuestions", JSON.stringify(questions));

document.getElementById("teacherSubject").value = "";
document.getElementById("questionInput").value = "";
document.getElementById("optionA").value = "";
document.getElementById("optionB").value = "";
document.getElementById("optionC").value = "";
document.getElementById("optionD").value = "";

displayTeacherQuestions();
loadSubjects();
renderHomeSubjects();

showToast("Question saved successfully!", "success");
}

function displayTeacherQuestions(){
const box = document.getElementById("teacherQuestions");
if(!box) return;

box.innerHTML = "";

if(!questions.length){
box.innerHTML = "<p>No questions yet.</p>";
return;
}

questions.forEach((q, index) => {
const div = document.createElement("div");
div.className = "card";
div.innerHTML = `
<h3>${escapeHTML(q.subject)}</h3>
<p><strong>${escapeHTML(q.question)}</strong></p>
<p class="small">Difficulty: ${escapeHTML(q.difficulty || "medium")}</p>
<ol>
${q.options.map(o => `<li>${escapeHTML(o)}</li>`).join("")}
</ol>
<button class="red" onclick="deleteQuestion(${index})">Delete</button>
`;
box.appendChild(div);
});
}

function deleteQuestion(index){
if(!confirm("Delete this question?")) return;

questions.splice(index, 1);
localStorage.setItem("quizQuestions", JSON.stringify(questions));

displayTeacherQuestions();
loadSubjects();
renderHomeSubjects();

showToast("Question deleted.", "success");
}

/* =========================================================
   SIMPLE MATERIAL HELPER
========================================================= */

function generateQuestions(){
const material = document.getElementById("materialInput").value.trim();

if(!material){
showToast("Paste some study material first.", "warning");
return;
}

const sentences = material
.split(/[.!?]/)
.map(s => s.trim())
.filter(s => s.length > 30)
.slice(0, 5);

if(!sentences.length){
showToast("Please paste a little more material.", "warning");
return;
}

const subject = prompt("What subject should these questions belong to?", "Study Material");
if(!subject) return;

sentences.forEach(sentence => {
questions.push({
subject: subject,
difficulty: "medium",
question: "What is mentioned in this statement? " + sentence,
options: [sentence, "None of the above", "A different statement", "Not mentioned"],
answer: 0
});
});

localStorage.setItem("quizQuestions", JSON.stringify(questions));
displayTeacherQuestions();
loadSubjects();
renderHomeSubjects();

document.getElementById("materialInput").value = "";
showToast("Created " + sentences.length + " practice questions!", "success");
}

/* =========================================================
   LEADERBOARD
========================================================= */

function showLeaderboard(){
const div = document.getElementById("leaderboard");
div.innerHTML = "";

if(!leaderboardData.length){
div.innerHTML = "<p class='center'>No scores yet. Be the first! 🏆</p>";
} else {
leaderboardData.forEach((player, index) => {
const row = document.createElement("div");
row.className = "leaderboard-row";

let medal = "";
if(index === 0) medal = "🥇";
else if(index === 1) medal = "🥈";
else if(index === 2) medal = "🥉";
else medal = (index + 1) + ".";

row.innerHTML = `
<div>
<span class="medal">${medal}</span>
<strong>${escapeHTML(player.name)}</strong><br>
<span class="small">${escapeHTML(player.rank)} • Level ${player.level}</span>
</div>
<div>
<strong>${player.score}%</strong><br>
<span class="small">${player.xp} XP</span>
</div>
`;
div.appendChild(row);
});
}

showScreen("leaderboardScreen");
}

/* =========================================================
   ANALYTICS
========================================================= */

function showAnalytics(){
displayAnalytics();
showScreen("analyticsScreen");
}

function displayAnalytics(){
const level = getLevel(statsData.xp);
const rank = getRank(level);

document.getElementById("analyticsLevel").textContent = "Level " + level;
document.getElementById("analyticsRank").textContent = rank;
document.getElementById("analyticsXP").textContent = statsData.xp;
document.getElementById("analyticsLevelBar").style.width = getLevelProgress(statsData.xp) + "%";
document.getElementById("analyticsQuizzes").textContent = statsData.quizzes;

const average = statsData.quizzes === 0 ? 0 : Math.round(statsData.totalScore / statsData.quizzes);
document.getElementById("analyticsAverage").textContent = average + "%";
document.getElementById("analyticsBest").textContent = statsData.best + "%";
document.getElementById("analyticsStreak").textContent = statsData.streak;

renderBadges();
}

/* =========================================================
   HOME
========================================================= */

function updateHome(){
const level = getLevel(statsData.xp);
const rank = getRank(level);

document.getElementById("homeQuestions").textContent = questions.length;
document.getElementById("homeBest").textContent = statsData.best + "%";
document.getElementById("homeStreak").textContent = statsData.streak;
document.getElementById("homeLevel").textContent = "Level " + level;
document.getElementById("homeRank").textContent = rank;
document.getElementById("homeXP").textContent = statsData.xp;
document.getElementById("nextXP").textContent = getXPToNextLevel(statsData.xp);
document.getElementById("homeLevelBar").style.width = getLevelProgress(statsData.xp) + "%";

const badges = getBadges();
document.getElementById("homeBadges").innerHTML = badges.length
? badges.map(b => `<span class="badge">${escapeHTML(b)}</span>`).join("")
: "No badges yet. Start a quiz!";

renderHomeSubjects();
}

/* =========================================================
   BADGES
========================================================= */

function renderBadges(){
const list = document.getElementById("badgesList");
if(!list) return;

const badges = getBadges();
list.innerHTML = badges.length
? badges.map(b => `<span class="badge">${escapeHTML(b)}</span>`).join("")
: "<p class='small'>Complete quizzes to unlock badges! 🚀</p>";
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value){
return String(value)
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#039;");
}

/* =========================================================
   AI QUIZ GENERATOR
========================================================= */

async function generateAIQuiz(){
const subject = document.getElementById("aiSubject").value.trim();
const materialBox = document.getElementById("aiMaterial");
const fileInput = document.getElementById("aiFile");
const status = document.getElementById("aiStatus");
const fileStatus = document.getElementById("fileStatus");
const quizBox = document.getElementById("aiQuiz");

let material = materialBox.value.trim();

quizBox.innerHTML = "";
status.innerHTML = "";

if(fileInput.files.length > 0){
const file = fileInput.files[0];
fileStatus.innerHTML = "📖 Reading " + escapeHTML(file.name) + "...";

try {
const formData = new FormData();
formData.append("file", file);

const response = await fetch("/api/upload-material", {
method: "POST",
body: formData
});

if(!response.ok) throw new Error("Server returned HTTP " + response.status);

const data = await response.json();
if(data.error) throw new Error(data.error);
if(!data.text) throw new Error("The server returned no readable text.");

material = data.text;
materialBox.value = material;
fileStatus.innerHTML = "✅ File successfully read!";
} catch(error) {
console.error(error);
fileStatus.innerHTML = "❌ Could not read the file.";
status.innerHTML = "Please make sure QuizMaster's server is running and the file is a supported PDF or text file.";
return;
}
}

if(!material){
status.innerHTML = "⚠️ Paste notes or upload a PDF/text file first.";
return;
}

status.innerHTML = "🤖 AI is creating your quiz...";

try {
const difficulty = document.getElementById("aiDifficulty").value;

const response = await fetch("/api/generate-quiz", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
subject: subject || "General",
difficulty: difficulty,
material: material
})
});

if(!response.ok) throw new Error("Server returned HTTP " + response.status);

const quiz = await response.json();
if(quiz.error) throw new Error(quiz.error);

if(!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0){
throw new Error("No questions were returned by the AI.");
}

status.innerHTML = "✅ AI quiz generated successfully!";

let html = `<h2>${escapeHTML(quiz.title || "AI Generated Quiz")}</h2>`;
html += `<div id="aiQuestions">`;

quiz.questions.forEach((q, index) => {
html += `
<div class="ai-question">
<h3>Q${index + 1}. ${escapeHTML(q.question || "")}</h3>
`;

if(q.type === "mcq" && Array.isArray(q.options)){
q.options.forEach(option => {
html += `
<label style="display:block;margin:10px 0;">
<input type="radio" name="question${index}" value="${escapeHTML(option)}">
${escapeHTML(option)}
</label>`;
});
} else if(q.type === "truefalse"){
html += `
<label><input type="radio" name="question${index}" value="True"> True</label>
<label style="margin-left:20px;"><input type="radio" name="question${index}" value="False"> False</label>`;
} else {
html += `<input type="text" id="short${index}" placeholder="Type your answer...">`;
}

html += `</div>`;
});

html += `
<button onclick="checkAIQuiz()">🏆 Submit Quiz</button>
<div id="aiScore" style="margin-top:20px;font-size:20px;font-weight:bold;"></div>
`;

quizBox.innerHTML = html;
window.currentAIQuiz = quiz;

} catch(error) {
console.error(error);
status.innerHTML = "❌ AI quiz generation failed: " + escapeHTML(error.message);
}
}

/* =========================================================
   CHECK AI QUIZ
========================================================= */

function checkAIQuiz(){
const quiz = window.currentAIQuiz;
if(!quiz) return;

let score = 0;
let total = 0;
const boxes = document.querySelectorAll(".ai-question");

quiz.questions.forEach((q, index) => {
const points = Number(q.points) || 1;
total += points;
let userAnswer = "";

if(q.type === "short"){
const input = document.getElementById("short" + index);
if(input) userAnswer = input.value.trim();
} else {
const selected = document.querySelector(`input[name="question${index}"]:checked`);
if(selected) userAnswer = selected.value.trim();
}

const correctAnswer = String(q.answer || "").trim();
const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();

if(isCorrect) score += points;

const box = boxes[index];
if(!box) return;

const old = box.querySelector(".ai-result");
if(old) old.remove();

const result = document.createElement("div");
result.className = "ai-result";

if(!userAnswer){
result.innerHTML = `⚠️ Not answered<br>Correct answer: ${escapeHTML(correctAnswer)}`;
} else if(isCorrect){
result.innerHTML = "✅ Correct";
} else {
result.innerHTML = `❌ Wrong<br>Your answer: ${escapeHTML(userAnswer)}<br>Correct answer: ${escapeHTML(correctAnswer)}`;
}

box.appendChild(result);
});

const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
document.getElementById("aiScore").textContent = `🏆 Score: ${score} / ${total} — ${percentage}%`;
}

/* =========================================================
   STARTUP
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
updateHome();
loadSubjects();
displayTeacherQuestions();
renderBadges();
});

/* =========================================================
   DARK MODE
========================================================= */

function toggleDarkMode() {
document.body.classList.toggle("dark");
const isDark = document.body.classList.contains("dark");
localStorage.setItem("quizMasterDarkMode", isDark ? "true" : "false");

const btn = document.getElementById("darkModeBtn");
if (btn) {
btn.innerHTML = isDark
? `<span class="nav-icon">◑</span>Light Mode`
: `<span class="nav-icon">◐</span>Dark Mode`;
}
}

document.addEventListener("DOMContentLoaded", () => {
const saved = localStorage.getItem("quizMasterDarkMode");
if (saved === "true") {
document.body.classList.add("dark");
const btn = document.getElementById("darkModeBtn");
if (btn) {
btn.innerHTML = `<span class="nav-icon">◑</span>Light Mode`;
}
}
});

/* =========================================================
   TOAST NOTIFICATIONS
========================================================= */

function showToast(message, type = "info") {
const oldToast = document.querySelector(".toast");
if (oldToast) oldToast.remove();

const toast = document.createElement("div");
toast.className = `toast ${type}`;
toast.textContent = message;
document.body.appendChild(toast);

setTimeout(() => {
toast.classList.add("show");
}, 10);

setTimeout(() => {
toast.classList.remove("show");
setTimeout(() => {
toast.remove();
}, 350);
}, 3000);
}