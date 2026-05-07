This chat has gotten too long and we are losing focus. I am going to start a new chat window. Please synthesize our entire conversation and fill out the following template so I can pass it to the new instance of you. Be highly concise, focus only on the current working state, and make sure to highlight the approaches that failed so the next agent doesn't repeat them. Here is the template to fill out:



# Developer Context Handoff & Initialization

You are taking over an active software development task from a previous session. Review the system state, architecture, and current blocker below. Acknowledge this context briefly, and then proceed directly to solving the "Immediate Next Step."



## 1. Project Architecture & Goal
- **System Overview:** [E.g., A full-stack Next.js web app / A Python data pipeline / A C++ game engine component]
- **Current Feature/Goal:** [E.g., Implementing JWT authentication / Optimizing a slow SQL query / Building a responsive navigation bar]



## 2. Tech Stack & Environment
- **Languages/Frameworks:** [E.g., React 18, TypeScript, Python 3.11, Django]
- **Key Libraries:** [E.g., Redux Toolkit, SQLAlchemy, TailwindCSS]
- **Environment:** [E.g., Node v20, Dockerized, AWS Lambda]



## 3. Coding Standards & Conventions
- **Typing:** [E.g., Strict typing required, no 'any' types]
- **Style/Linting:** [E.g., PEP8, Prettier, ESLint Airbnb config]
- **Testing/Error Handling:** [E.g., Must include Jest unit tests, fail fast, use custom error classes]
- **Other Rules:** [E.g., Functional components only, prioritize DRY principles, comment complex logic]



## 4. Current State & Working Code
The following code represents the current, functional state of the relevant files. Assume the rest of the application works as intended.

**`[filename.ext]`**
```[language]
// Insert ONLY the relevant snippets of working code here.
// Omit irrelevant boilerplate.

```



## 5. Dead Ends (What Not To Do)

To save time, DO NOT suggest the following approaches, as they have already failed or violate our constraints:

* [E.g., We tried using `useEffect` for this, but it caused race conditions.]
* [E.g., Do not suggest switching to a different library; we are locked into `Axios`.]



## 6. The Blocker (Error Logs & Symptoms)

We are currently stuck on the following issue:

* **Expected Behavior:** [What should happen]
* **Actual Behavior:** [What is actually happening]
* **Error Logs / Stack Trace:**

```text
// Paste the exact terminal output, compiler error, or console log here.

```



## 7. Immediate Next Step

[E.g., "Analyze the stack trace and tell me why the database connection is timing out," or "Provide the refactored code for `App.tsx` that fixes the state mutation issue."]