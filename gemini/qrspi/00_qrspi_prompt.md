When opening a new chat window for a QRSPI stage, use a structured text template like this directly in the main chat box:

```
*** SYSTEM INSTRUCTIONS ***
[Paste the entirety of the QRSPI Markdown file here]

*** CURRENT STATE / CONTEXT ***
[Paste the output from the previous step, historical decisions, or current file contents here]

*** IMMEDIATE REQUEST ***
[Your specific query, execution command, or clarification answer]
```

By explicitly boxing the markdown file under a "SYSTEM INSTRUCTIONS" header in raw text, we mathematically force Gemini underlying model to treat those rules as the immutable behavioral boundaries for the session, guaranteeing a much tighter adherence to the QRSPI workflow.