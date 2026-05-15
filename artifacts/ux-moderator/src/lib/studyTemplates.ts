export interface StudyTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  goal: string;
  durationMinutes: number;
  questions: string[];
}

export const STUDY_TEMPLATES: StudyTemplate[] = [
  {
    id: "discovery",
    name: "Discovery Interview",
    description: "Open-ended exploration of user behaviors, motivations, and pain points.",
    icon: "🔍",
    goal: "Understand the user's current behaviors, challenges, and motivations related to our product space to identify unmet needs and opportunities.",
    durationMinutes: 30,
    questions: [
      "Walk me through how you currently handle [the problem space]. What does a typical day look like for you?",
      "What are the biggest frustrations or challenges you face with your current approach?",
      "Tell me about a time when things didn't go as planned. What happened and how did you recover?",
      "What does an ideal solution look like to you? What would make your life significantly easier?",
      "Is there anything else about your experience that you'd like to share that we haven't covered?",
    ],
  },
  {
    id: "concept-test",
    name: "Concept Test",
    description: "Evaluate early-stage concepts and ideas with target users before building.",
    icon: "💡",
    goal: "Validate product concepts by understanding user reactions, mental models, and perceived value to inform design decisions.",
    durationMinutes: 20,
    questions: [
      "Before I tell you anything about this concept, what's your first reaction when you look at it?",
      "In your own words, can you describe what you think this product does?",
      "Who do you think this is designed for? Does that include you?",
      "What do you find most appealing about this concept? What gives you pause?",
      "On a scale from 1–10, how likely would you be to use this if it existed? What would make you rate it higher?",
    ],
  },
  {
    id: "usability",
    name: "Usability Study",
    description: "Evaluate how easily users can complete key tasks with your product.",
    icon: "🖱️",
    goal: "Identify usability barriers and friction points in key user flows to improve task completion rates and overall experience.",
    durationMinutes: 45,
    questions: [
      "Without any guidance from me, can you show me how you would accomplish [key task]? Please think out loud as you go.",
      "At what point did you feel uncertain or unsure about what to do next?",
      "Was there anything on the screen that confused you or didn't match your expectations?",
      "How does this experience compare to similar products you've used before?",
      "If you could change one thing about this flow, what would it be and why?",
    ],
  },
  {
    id: "pricing",
    name: "Pricing Research",
    description: "Understand user willingness to pay and perceived value of your offering.",
    icon: "💰",
    goal: "Determine appropriate pricing strategy by uncovering user value perception, budget expectations, and price sensitivity.",
    durationMinutes: 25,
    questions: [
      "Tell me about the tools or services you currently pay for to solve this problem. What do you spend per month?",
      "What would make you feel like a product in this space is worth paying for?",
      "If this product were available today, how much would you expect to pay for it per month? What's driving that number?",
      "At what price would this feel like a great deal? At what price would it feel too expensive to consider?",
      "What would need to be included in the product for you to pay a premium price for it?",
    ],
  },
  {
    id: "feature-validation",
    name: "Feature Validation",
    description: "Validate whether a specific feature solves a real problem your users face.",
    icon: "✅",
    goal: "Determine if a planned feature addresses a genuine user need and whether users would actually adopt it in their workflow.",
    durationMinutes: 20,
    questions: [
      "Have you ever experienced a situation where [the problem this feature solves] was a real challenge for you?",
      "How do you currently work around this problem? Walk me through your process.",
      "When I describe this feature to you — [feature description] — what's your immediate reaction?",
      "Can you see yourself using this feature regularly? In what situations would it be most useful?",
      "What concerns or questions would you have before adopting this feature in your day-to-day workflow?",
    ],
  },
];
