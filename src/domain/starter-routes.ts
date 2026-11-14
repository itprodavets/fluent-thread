import type { ConversationRoute } from './conversation-route';

export const starterRoutes: ConversationRoute[] = [
  {
    id: 'example-dinner', language: 'en', title: 'Dinner with Friends',
    steps: [
      { id: 'choose', title: 'Choosing Where to Eat', transition: '', dialogue: 'Maya: Shall we try the restaurant by the river?\nAlex: I like the location, but do they have dishes without meat?\nMaya: I checked the menu. They have mushroom dumplings.\nAlex: Great. Let’s book a table there for seven.' },
      { id: 'order', title: 'Ordering at the Restaurant', transition: 'The menu has options for everyone, so we book a table and order when we arrive.', dialogue: 'Server: Are you ready to order?\nAlex: Almost. Are the mushroom dumplings made without meat?\nServer: Yes. Would you like a plate to share?\nAlex: Please. Could we also have some tea?' },
      { id: 'review', title: 'Deciding Whether to Return', transition: 'After dinner, we talk about whether the restaurant was worth the visit.', dialogue: 'Maya: Would you come here again?\nAlex: Yes. The view was lovely, but the food was what made it worth coming.\nMaya: I agree. Let’s bring Sam next time.\nAlex: Good idea. I think he’d like the dumplings.' }
    ]
  },
  {
    id: 'example-class', language: 'en', title: 'An English Class on Zoom',
    steps: [
      { id: 'meet', title: 'Meeting a Classmate', transition: '', dialogue: 'Maya: Hi! I don’t think we’ve met. Where are you joining from?\nAlex: Guangzhou. I’m from Russia, but I live in China now. How about you?\nMaya: I’m in London. Oh, the teacher’s here. Let’s talk during the break.\nAlex: Sounds good. See you then.' },
      { id: 'instructions', title: 'Clarifying the Task', transition: 'The teacher joins and explains a group activity.', dialogue: 'Teacher: Read the two opinions on your own, then compare your notes.\nAlex: Sorry, could I check something? Should we choose one position together?\nTeacher: You can disagree. Just explain why you chose your argument.\nAlex: Thanks. So we read first and discuss our reasons afterwards.' },
      { id: 'debate', title: 'Discussing a Pedestrian Zone', transition: 'We finish reading and compare what the proposed pedestrian zone would mean for local shops.', dialogue: 'Maya: I’d make the high street car-free all day.\nAlex: Can I just add something? How would the smaller shops get deliveries?\nMaya: We could let vans in before nine. Would that help?\nAlex: It might. Let’s suggest trying it for a month and asking shops what changed.' }
    ]
  },
  {
    id: 'example-interview', language: 'en', title: 'An Interview at a Tea Shop',
    steps: [
      { id: 'experience', title: 'Talking About Experience', transition: '', dialogue: 'Manager: What drew you to this role?\nAlex: I’m part of a community of tea enthusiasts. I enjoy helping people find teas they like.\nManager: Can you give me an example?\nAlex: At a tasting, I helped a guest compare two oolongs. I asked what flavours she liked before recommending one.' },
      { id: 'scenario', title: 'Handling a Customer Question', transition: 'The manager follows up on the tasting example with a customer scenario.', dialogue: 'Manager: What would you do if a customer said all tea tasted bitter?\nAlex: I’d ask how they usually brew it. Water that’s too hot or a long steep can make some teas bitter.\nManager: And if they were in a hurry?\nAlex: I’d offer one quick tip and suggest a tea they could try.' },
      { id: 'trial', title: 'Arranging a Trial Shift', transition: 'After the scenario, the manager offers a trial shift.', dialogue: 'Manager: Could you come in on Friday for a trial shift?\nAlex: Yes. What time should I arrive, and who should I ask for?\nManager: Come at ten and ask for Maya. She’ll show you around.\nAlex: Thanks. I’ll see you on Friday.' }
    ]
  }
];
