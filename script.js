
const prompts = [
  "Write about a rule that makes sense until someone breaks it.",
  "Describe a place that feels different after dark. Use all five senses.",
  "Is loyalty always a good thing? Defend your answer with an example.",
  "Begin a story with: Nobody noticed the empty chair until lunch.",
  "What is something adults often misunderstand about being your age?",
  "Choose an ordinary object and give it a secret history."
];
const tools = {
  reading: [
    ["Notice", "Mark details that repeat, surprise you, or create a strong feeling."],
    ["Name", "Put the pattern into words: character, conflict, craft, or big idea."],
    ["Connect", "Explain why it matters. Link the evidence to a larger interpretation."]
  ],
  writing: [
    ["Claim", "Say something specific, arguable, and worth proving."],
    ["Evidence", "Choose the strongest detail or quotation, not simply the first one."],
    ["Reasoning", "Build the bridge between your evidence and your claim."]
  ],
  vocab: [
    ["Context", "Read around the word. Look for examples, contrasts, tone, and clues."],
    ["Parts", "Break the word into prefixes, roots, and suffixes you recognize."],
    ["Use It", "Make the word yours by using it in a fresh sentence and conversation."]
  ]
};
const bookPaths = [
  "Want high-stakes friendship and identity? Start with a realistic coming-of-age novel like The Outsiders.",
  "Want a puzzle? Try a mystery with an unreliable narrator and keep a clue log.",
  "Want another world? Choose a fantasy with a rule-based magic system and map its rules.",
  "Short on time? Try a graphic novel or short-story collection. Visual reading is still real reading.",
  "Want something true? Pick narrative nonfiction about a person, event, or question you already care about."
];
const promptCard = document.querySelector("#prompt-card");
const promptText = document.querySelector("#prompt-text");
function showPrompt(){ promptText.textContent = prompts[Math.floor(Math.random()*prompts.length)]; promptCard.hidden=false; }
document.querySelector("#prompt-button").addEventListener("click",showPrompt);
document.querySelector("#new-prompt").addEventListener("click",showPrompt);
function renderTools(key){document.querySelector("#tool-content").innerHTML=tools[key].map(([title,body])=>`<article class="tool-card"><b>${title}</b><p>${body}</p></article>`).join("");}
document.querySelectorAll(".tool-tabs button").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll(".tool-tabs button").forEach(b=>b.classList.remove("active"));button.classList.add("active");renderTools(button.dataset.tab);}));
renderTools("reading");
const date = new Date();
document.querySelector("#today-date").textContent = date.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const result=document.querySelector("#book-result");
document.querySelector("#book-picker").addEventListener("click",()=>{result.innerHTML=`${bookPaths[Math.floor(Math.random()*bookPaths.length)]}<button aria-label="Close suggestion">×</button>`;result.hidden=false;result.querySelector("button").addEventListener("click",()=>result.hidden=true);});
const menu=document.querySelector(".menu-button"),nav=document.querySelector(".site-header nav");
menu.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",open);});
nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
const fastContent={
  Read:["Read the question first","Before reading every word, identify exactly what the item asks you to do. This gives your brain a target."],
  Annotate:["Annotate with a purpose","Mark only the sentence or phrase that helps answer the question. Too many marks hide the strongest evidence."],
  Choose:["Choose with evidence","Say your own answer first. Then test each option against the text and cross out choices that are partly true, off-topic, or unsupported."],
  Explain:["Explain why it wins","Point to the exact words that prove the answer. If you cannot prove it, pause and reconsider your choice."]
};
document.querySelectorAll(".strategy-step").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll(".strategy-step").forEach(b=>b.classList.remove("active"));button.classList.add("active");const [title,copy]=fastContent[button.dataset.fast];document.querySelector("#fast-title").textContent=title;document.querySelector("#fast-copy").textContent=copy;}));

