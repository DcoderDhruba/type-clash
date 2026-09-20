/**
 * FUNNY RACE MESSAGES
 * ===================
 * This file is meant to be edited. Add, change or delete messages freely.
 * The message on the results screen is picked at random for each race, but it stays the same when
 * that page is refreshed. The live messages during a race are picked at random each time.
 *
 * To add a message, add a line to one of the lists below:
 *
 *     { icon: "🦄", text: "You typed like a unicorn on a sugar rush." },
 *
 * - `icon` is any emoji (or a couple of them).
 * - `text` is the message. Keep it a sentence or two.
 * - You can use these placeholders inside `text`; they are filled in for you:
 *       {name}       your own username
 *       {wpm}        your own speed
 *       {winner}     the winner's username (if two players tie for first: "a and b")
 *       {winnerWpm}  the winner's speed
 *       {leader}     the player who is currently ahead (only makes sense in the live lists)
 *   For example:  { icon: "😤", text: "{winner} got lucky. Definitely lucky." }
 *
 * WHEN EACH LIST IS USED
 *   Shown when the race is over, based on how you finished:
 *     winner        you finished first, alone
 *     tie           you tied for first with someone
 *     second        you finished 2nd
 *     third         you finished 3rd
 *     middle        you finished 4th or lower, but not last
 *     last          you finished last in a race of 3 or more players
 *     lost          you lost a 1v1 challenge (used instead of second/third/middle/last)
 *     noTyping      you finished with 0 wpm (never typed anything)
 *     didNotFinish  your result never arrived (closed the tab, lost connection...)
 *     abandoned     nobody typed anything at all
 *
 *   Shown live during the race, based on where you are right now:
 *     leading       you are in front
 *     chasing       you are 2nd or 3rd
 *     behind        you are 4th or lower
 *
 * An empty list is fine: that situation just shows no funny message.
 */

export interface FunnyMessage {
  icon: string;
  text: string;
}

export type FunnyCategory =
  | "winner"
  | "tie"
  | "second"
  | "third"
  | "middle"
  | "last"
  | "lost"
  | "noTyping"
  | "didNotFinish"
  | "abandoned"
  | "leading"
  | "chasing"
  | "behind";

export const FUNNY_MESSAGES: Record<FunnyCategory, FunnyMessage[]> = {

  // ---- After the race ---------------------------------------------------
  winner: [
    { icon: "👑", text: "All hail {name}, ruler of the keyboard!" },
    { icon: "🚀", text: "{wpm} wpm? That was less typing and more rocket launch." },
    { icon: "🔥", text: "Your keyboard is smoking. Somebody call the fire department!" },
    { icon: "🦸", text: "Fastest fingers in the room. Cape not included." },
    { icon: "😎", text: "Winner winner, chicken dinner. Everyone else gets the crumbs." },
    { icon: "🐆", text: "The cheetahs called. They want their speed back." },
    { icon: "🎤", text: "Mic drop. Keyboard drop. Whatever, you won." },
    { icon: "🧙", text: "Are your fingers enchanted? Asking for everyone you just beat." },
    { icon: "⚡", text: "That wasn't typing. That was a lightning strike." },
    { icon: "🏆", text: "The trophy has your name on it. Literally." },
    { icon: "💀", text: "Everyone else just got absolutely keyboard-diffed." },
    { icon: "🗿", text: "Calm face. Violent typing speed." },
    { icon: "🌪️", text: "You didn't race. You caused a typing tornado." },
    { icon: "🧨", text: "Keyboard survived. Everyone's ego didn't." },
    { icon: "👽", text: "Confirmed: you're typing with alien technology." },
    { icon: "🎯", text: "Accuracy, speed, destruction. A complete package." },
    { icon: "💻", text: "Your keyboard would like to file a complaint." },
    { icon: "🥶", text: "Ice cold finish. Absolutely no mercy." },
    { icon: "🫡", text: "Respectfully, that was ridiculous." },
  ],

  tie: [
    { icon: "🤝", text: "A perfect tie! Twins separated at birth, typing edition." },
    { icon: "🪞", text: "Same speed, same accuracy. Are you two secretly the same person?" },
    { icon: "⚖️", text: "The judges are stunned. It's a dead heat!" },
    { icon: "🥊", text: "Nobody blinked. Rematch, anyone?" },
    { icon: "🧬", text: "Identical results. Suspiciously identical. We're watching you." },
    { icon: "🤯", text: "A tie?! The keyboard gods refuse to choose." },
    { icon: "🧐", text: "Statistically impressive. Emotionally inconvenient." },
    { icon: "🔮", text: "The crystal ball says... absolutely nothing. It's a tie." },
    { icon: "🎲", text: "Roll again. The universe couldn't decide." },
    { icon: "👯", text: "Same score. Same chaos. Same bragging rights." },
    { icon: "⚔️", text: "Two warriors. One result. Zero bragging advantage." },
    { icon: "🧑‍⚖️", text: "The judges checked twice. Still a tie." },
    { icon: "📊", text: "The spreadsheet has officially given up." },
  ],

  second: [
    { icon: "🥈", text: "So close! Silver looks good on you." },
    { icon: "😤", text: "{winner} got lucky. Definitely lucky. Totally lucky." },
    { icon: "🍪", text: "Second place gets a cookie. First place gets a cookie and bragging rights." },
    { icon: "🎯", text: "Silver medal! The most respectable way to lose." },
    { icon: "👀", text: "You could see the finish line and {winner}'s back. Painful." },
    { icon: "☕", text: "One extra coffee and that would have been gold." },
    { icon: "📈", text: "So close to first that you can practically smell the trophy." },
    { icon: "😏", text: "Second place today. Revenge arc loading..." },
    { icon: "🥊", text: "{winner} won the round. The rivalry has officially begun." },
    { icon: "🫠", text: "You were THIS close. Yes, we're pointing at the tiny gap." },
    { icon: "🏃", text: "Chasing gold, caught silver." },
    { icon: "🧂", text: "Just a pinch of salt away from first place." },
    { icon: "🎮", text: "Achievement unlocked: Professional Runner-Up." },
    { icon: "🪜", text: "One more step up the podium. You got this." },
  ],

  third: [
    { icon: "🥉", text: "Bronze! Somebody has to hold the podium up." },
    { icon: "☕", text: 'Third place: the "I was just warming up" spot.' },
    { icon: "🎈", text: "You made the podium! The standing-room-only section." },
    { icon: "🍞", text: "Bronze is basically gold if you squint really hard." },
    { icon: "🧁", text: "Podium finish! Cupcakes are on the winners' tab." },
    { icon: "😎", text: "Bronze today, suspiciously confident tomorrow." },
    { icon: "🎖️", text: "Not gold. Not silver. Still shiny." },
    { icon: "🐕", text: "You chased the podium and caught the bronze." },
    { icon: "📸", text: "Smile! You're officially podium material." },
    { icon: "🔥", text: "Third place, but the keyboard was impressed." },
    { icon: "🥔", text: "Bronze medal acquired. Potato mode avoided." },
    { icon: "🚦", text: "Green means go. You went... eventually." },
    { icon: "🎪", text: "Three podium spots. You claimed one." },
  ],

  middle: [
    { icon: "🚶", text: "Solid mid-pack energy. The pack says hi." },
    { icon: "⚖️", text: "Not first, not last. Perfectly balanced, as all things should be." },
    { icon: "🍿", text: "You had a great view of the race from the middle." },
    { icon: "🚲", text: "Cruising at a comfortable speed. Safety first!" },
    { icon: "🧘", text: "Zen typist. Winning was never the point. (It was a little bit the point.)" },
    { icon: "🤷", text: "Respectable! Nobody will remember this race, so you're safe." },
    { icon: "🎯", text: "Right in the middle. The statistical sweet spot." },
    { icon: "🛋️", text: "Comfortably seated in the land of average." },
    { icon: "🦆", text: "Just floating along. Quack, type, repeat." },
    { icon: "🍿", text: "You weren't racing. You were watching the chaos from VIP seating." },
    { icon: "🧍", text: "Standing proudly in the middle of absolutely everything." },
    { icon: "📍", text: "You have successfully located the middle." },
    { icon: "😌", text: "No pressure. No trophy. No problem." },
    { icon: "🚗", text: "Cruise control: activated." },
    { icon: "🎵", text: "Typing at the speed of background music." },
    { icon: "🫡", text: "Middle of the pack, middle of the drama." },
  ],

  last: [
    { icon: "🐢", text: "Last place. The turtle wants to know if you need a lift." },
    { icon: "🐌", text: "Slow and steady... mostly slow." },
    { icon: "🦥", text: "Were you typing with oven mitts on?" },
    { icon: "🛌", text: "Sleep typing? Bold strategy." },
    { icon: "🦖", text: "Typing with tiny T-rex arms? We respect the hustle." },
    { icon: "🍯", text: "Your fingers took the scenic route." },
    { icon: "🕺", text: "{winner} finished so long ago they've already started the victory dance." },
    { icon: "📅", text: "No rush. The next race is only... whenever you're ready." },
    { icon: "🐛", text: "Even the loading bar was getting impatient." },
    { icon: "🧓", text: "Your keyboard is asking if you've seen the new technology called 'speed'." },
    { icon: "🚶", text: "Everybody sprinted. You chose a peaceful walk." },
    { icon: "🛸", text: "At least you got a tour of the entire race track." },
    { icon: "📞", text: "The finish line called. It was getting worried." },
    { icon: "🐨", text: "Maximum chill. Minimum WPM." },
    { icon: "🥱", text: "Your fingers appear to be on their lunch break." },
    { icon: "🧘", text: "You weren't slow. You were spiritually elsewhere." },
    { icon: "🚧", text: "Speed bump detected. Actually, several speed bumps." },
  ],

  lost: [
    { icon: "😤", text: "{winner} got lucky. Definitely lucky. Totally lucky." },
    { icon: "😏", text: "You lost this one. Revenge arc loading..." },
    { icon: "🥊", text: "{winner} won the round. The rivalry has officially begun." },
    { icon: "🍪", text: "Losing is just practice with extra snacks." },
    { icon: "☕", text: "One extra coffee and this would have gone your way." },
    { icon: "🎮", text: "Achievement unlocked: Learning Experience." },
    { icon: "📈", text: "{winner} typed {winnerWpm} wpm. You know exactly what to beat." },
    { icon: "🔁", text: "Best of one is unfair. Ask for a rematch!" },
    { icon: "🧂", text: "A little salty? That's fine. It makes the comeback taste better." },
    { icon: "🫡", text: "Respect to {winner}. Now go get them in the rematch." },
  ],

  noTyping: [
    { icon: "🤔", text: "Zero wpm. Did the keyboard even turn on?" },
    { icon: "🧊", text: "Frozen like a deer in headlights. It happens to the best of us." },
    { icon: "🏖️", text: "Speed: 0. Vibes: immaculate." },
    { icon: "👻", text: "You raced like a ghost. Very sneaky, very slow." },
    { icon: "📖", text: "Were you busy reading the words really, really carefully?" },
    { icon: "⌨️", text: "The keyboard has officially reported zero activity." },
    { icon: "🫥", text: "Your WPM is so low it's basically invisible." },
    { icon: "⏸️", text: "You pressed start but forgot the part where you type." },
    { icon: "🧍", text: "Hands detected. Typing not detected." },
    { icon: "🔋", text: "Your fingers appear to be running on 0% battery." },
    { icon: "🧐", text: "Interesting strategy: simply don't type." },
    { icon: "🎭", text: "Performance art disguised as a typing race." },
    { icon: "📡", text: "Searching for your typing signal... nothing found." },
    { icon: "🚫", text: "Typing has left the building." },
  ],

  didNotFinish: [
    { icon: "📡", text: "Your result got lost in space. Probably aliens." },
    { icon: "🔌", text: "Connection lost? Rage quit? We may never know." },
    { icon: "🫠", text: "You vanished mid-race like a magician. Where did you go?" },
    { icon: "🚧", text: "DNF: Did Not Finish. Did Nap Freely." },
    { icon: "🏃", text: "You started running and then remembered you hate cardio." },
    { icon: "🚪", text: "And just like that... you left the race." },
    { icon: "🫡", text: "A brave attempt. A mysterious disappearance." },
    { icon: "📺", text: "Plot twist: the racer simply stopped existing." },
    { icon: "🛑", text: "Race interrupted. Fingers on vacation." },
    { icon: "🕵️", text: "Detectives are investigating your mysterious disappearance." },
    { icon: "🎬", text: "To be continued... hopefully." },
    { icon: "👋", text: "You said 'goodbye' to the race without saying goodbye." },
  ],

  abandoned: [
    { icon: "🌵", text: "Tumbleweed. Nobody typed anything." },
    { icon: "🦗", text: "Crickets. Absolutely nothing happened." },
    { icon: "🍩", text: "The race was abandoned. Everyone was probably distracted by snacks." },
    { icon: "🏚️", text: "This race is now officially an abandoned building." },
    { icon: "👻", text: "No racers. No typing. Just ghosts." },
    { icon: "🪦", text: "Here lies a race that never really began." },
    { icon: "🌚", text: "Everyone left. Even the keyboard gave up." },
    { icon: "🛒", text: "Race abandoned. Snacks acquired." },
    { icon: "🚪", text: "The race room is empty. Awkward." },
    { icon: "📭", text: "No typing here. Please try another race." },
    { icon: "🧹", text: "Nothing happened. Time to clean up the keyboard." },
  ],

  // ---- During the race --------------------------------------------------

  leading: [
    { icon: "🚀", text: "You're in the lead! Don't look back!" },
    { icon: "🔥", text: "First place! Your keyboard is on fire!" },
    { icon: "👑", text: "Leading the pack. The crown suits you." },
    { icon: "🏃", text: "Everyone is chasing you. Run, {name}, run!" },
    { icon: "😎", text: "Comfortably ahead. Try to look casual." },
    { icon: "⚡", text: "You're typing faster than everyone's excuses." },
    { icon: "🏎️", text: "Pole position! Keep the keyboard pedal down." },
    { icon: "🎯", text: "Locked on target: FIRST PLACE." },
    { icon: "🦅", text: "Flying above the competition. Literally." },
    { icon: "💨", text: "You're leaving nothing but keyboard dust behind." },
    { icon: "🧨", text: "Your WPM just entered dangerous territory." },
    { icon: "🥶", text: "Ice-cold fingers. Red-hot leaderboard." },
    { icon: "📢", text: "Attention everyone: we have a speed demon." },
    { icon: "🐆", text: "Cheetah mode activated." },
    { icon: "🕶️", text: "Looking dangerously fast and annoyingly cool." },
  ],

  chasing: [
    { icon: "💨", text: "So close! {leader} is right there. Catch them!" },
    { icon: "🎯", text: "On podium pace! Push a little harder!" },
    { icon: "🐇", text: "You smell victory. Or maybe it's {leader}'s dust." },
    { icon: "🏇", text: "Chasing {leader}. Bonus points for dramatic keyboard slamming." },
    { icon: "👀", text: "{leader} keeps peeking back at you. Give them a scare!" },
    { icon: "🔥", text: "You're closing the gap! {leader} should be nervous." },
    { icon: "🏎️", text: "{leader} has the lead, but you're gaining speed." },
    { icon: "🦈", text: "You're circling {leader}. Time to strike." },
    { icon: "⚔️", text: "The hunt is on. {leader} has been warned." },
    { icon: "📈", text: "Your speed is climbing. Their confidence is not." },
    { icon: "😈", text: "Keep typing. Ruining {leader}'s day is almost free." },
    { icon: "🏃", text: "Close the gap! Make {leader} question everything." },
    { icon: "💀", text: "{leader} can hear your keyboard getting closer." },
    { icon: "🚨", text: "Warning: {leader} is being hunted." },
  ],

  behind: [
    { icon: "🐢", text: "Slow and steady... but mostly slow. Speed up!" },
    { icon: "🎬", text: "Plenty of time for a comeback. Movies have been made about less!" },
    { icon: "🚴", text: "The race is long, and {leader} is probably nervous." },
    { icon: "🦥", text: "Sloth mode engaged. Wake those fingers up!" },
    { icon: "🍌", text: "{leader} is far ahead. Maybe fuel up with a banana?" },
    { icon: "📢", text: "Your keyboard would like you to pick up the pace." },
    { icon: "🏃", text: "{leader} is running away with it. Literally." },
    { icon: "🚗", text: "You're driving in second gear. Shift up!" },
    { icon: "⚡", text: "More speed! Your fingers aren't on a coffee break." },
    { icon: "🐌", text: "The snail called. It wants its speed back." },
    { icon: "⏰", text: "Time waits for nobody. Especially not your WPM." },
    { icon: "🎯", text: "Aim for the finish line, not the excuses." },
    { icon: "😤", text: "{leader} is getting comfortable. Don't let them." },
    { icon: "💨", text: "Comeback mode is still available. Use it!" },
    { icon: "🧨", text: "Explode into action before {leader} gets too comfortable." },
  ],
};