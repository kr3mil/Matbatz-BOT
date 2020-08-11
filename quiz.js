const Entities = require("html-entities").XmlEntities;
const Discord = require("discord.js");

const entities = new Entities();
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

let isQuizRunning = false;
let isQuizStarting = false;
let players = [];
let channel = undefined;
let questions = [];
let questionCount = 0;
let messagesToDelete = [];
let answers = [];
let correctAnswer = "";
let waiting = false;

async function startQuiz(message) {
  if (isQuizRunning) {
    return;
  }

  if (isQuizStarting) {
    // TODO force start quiz with players that have joined
    return actualStart(message);
  }

  console.log("Starting quiz");
  isQuizStarting = true;
  channel = message.channel;
  messagesToDelete.push(
    await channel.send(`A quiz will start soon! Join by typing: $joinquiz`)
  );
  joinQuiz(message);
  // TODO send message in chat asking players to join
  // TODO start a 30 second timer allowing people to join, can be overwritten by writing $startquiz again
}

async function actualStart(message, attempt = 0) {
  deleteBacklog();

  isQuizRunning = true;
  isQuizStarting = false;
  console.log("quiz started");
  messagesToDelete.push(await channel.send("Quiz started!"));

  if (attempt > 5) {
    console.error("something wrong with getting quiz from api");
    isQuizRunning = false;
    isQuizStarting = false;
    return;
  }
  // TODO send message in channel saying quiz has started
  try {
    let req = new XMLHttpRequest();
    req.open(
      "GET",
      "https://opentdb.com/api.php?amount=3&category=11&difficulty=easy&type=multiple",
      true
    );

    req.send();

    req.onreadystatechange = (e) => {
      if (req.readyState == 4 && req.status >= 200 && req.status < 400) {
        console.log("got quiz");
        try {
          const data = JSON.parse(req.responseText);
          const results = data["results"];
          results.forEach((result) => {
            let wrongAns = result["incorrect_answers"];
            wrongAns = wrongAns.map((answer) => entities.decode(answer));
            questions.push({
              question: entities.decode(result["question"]),
              correct: entities.decode(result["correct_answer"]),
              wrong: wrongAns,
            });
          });

          askQuestion();
        } catch {
          console.error("error parsing data from quiz json");
        }
      }
    };
  } catch {
    console.error("error when using http request in quiz");
  }
}

function handleQuizAnswer(message) {
  if (waiting) return;

  console.log(
    `isQuizRunning: ${isQuizRunning}, isQuizStarting: ${isQuizStarting}`
  );
  if (!isQuizRunning || isQuizStarting) return;

  let name = message.member.nickname;
  if (name == undefined) {
    name = message.member.user.username;
  }
  if (!players.some((value) => value.name === name)) {
    console.log("player not in players list");
    return;
  }
  const answer = message.content.split(" ")[0];
  if (!answers.some((value) => value.user === name)) {
    console.log(`${name} guessed ${answer}`);
    answers.push({ user: name, answer: answer });

    if (answers.length == players.length) {
      console.log("all players answered");
      checkAnswers();
    }
  }
}

async function joinQuiz(message) {
  if (isQuizRunning || !isQuizStarting) return;

  // Get name from message
  let name = message.member.nickname;
  if (name == undefined) {
    name = message.member.user.username;
  }
  if (!players.some((value) => value.name === name)) {
    console.log(`adding ${name} to players list`);
    players.push({ name: name, points: 0 });
    messagesToDelete.push(await channel.send(`${name} joined the quiz!`));
  }
}

async function askQuestion() {
  // TODO send embedded question in channel
  // TODO call checkAnswers after 10 seconds
  let question = questions[questionCount];
  console.log("displaying question");
  console.log(questions[questionCount]);

  let qAns = [
    question["correct"],
    question["wrong"][0],
    question["wrong"][1],
    question["wrong"][2],
  ];
  qAns = qAns.sort(() => Math.random() - 0.5);
  correctAnswer = qAns.indexOf(question["correct"]) + 1;
  console.log(`Correct answer: ${correctAnswer}`);

  const embed = new Discord.MessageEmbed()
    .setTitle(`${question["question"]}`)
    .setDescription(
      `1 - ${qAns[0]}\n2 - ${qAns[1]}\n3 - ${qAns[2]}\n4 - ${qAns[3]}`
    )
    .setColor(0xf1c40f)
    .setFooter(`Question ${questionCount + 1}`);

  messagesToDelete.push(await channel.send(embed));
}

async function checkAnswers() {
  // TODO call askQuestion after 5 seconds if there are more questions else end
  await deleteBacklog();
  let whoGuessed = "";
  answers.forEach((answer) => {
    if (answer.answer == correctAnswer) {
      let player = players.find((obj) => obj.name === answer.user);
      if (whoGuessed.length > 0) whoGuessed += ", ";
      whoGuessed += `${player.name}`;
      player.points++;
      console.log(players.find((obj) => obj.name === answer.user));
    }
  });
  whoGuessed =
    whoGuessed.length > 0
      ? whoGuessed + " guessed correctly, well done."
      : "No-one guessed correctly, retards.";
  messagesToDelete.push(await channel.send(whoGuessed));

  answers = [];
  correctAnswer = "";
  questionCount++;

  if (questions.length == questionCount) {
    console.log("FINISHED QUIZ");

    setTimeout(() => deleteBacklog(), 3000);

    players.sort((a, b) => a.points > b.points);

    const embed = new Discord.MessageEmbed()
      .setTitle(`Congratulations ${players[0].name}!`)
      .addFields(
        players.map((player) => {
          return { name: `${player.points} points`, value: player.name };
        })
      )
      .setColor(0xf1c40f)
      .setTimestamp()
      .setFooter("Final scores");
    channel.send(embed);
    // TODO display final scoreboard as embed

    isQuizRunning = false;
    isQuizStarting = false;
    players = [];
    channel = undefined;
    questions = [];
    questionCount = 0;
    answers = [];
    waiting = false;
    correctAnswer = "";
  } else {
    setTimeout(() => {
      waiting = false;
      askQuestion();
    }, 3000);
  }
}

function deleteBacklog() {
  messagesToDelete.forEach(async (msg) => {
    await msg.delete();
  });
  messagesToDelete = [];
}

module.exports = {
  joinQuiz,
  startQuiz,
  handleQuizAnswer,
};
