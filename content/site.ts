// pre-order launch content — every sample value here hides its element when set to 0 / "" / [].
export const appStoreUrl = "#app-store"; // TODO(launch): replace with the App Store URL

export const proof = {
  preorders: 1240, // TODO(launch): real number from App Store Connect, or set to 0 to hide
  demoWeeksThisMonth: 3400, // TODO(launch): real number from analytics, or 0 to hide
  avgWeekUsd: 39.72,
};

export const launchWindow = "this fall"; // TODO(launch): only show if the date is firm; "" hides it everywhere

export const perk = "pre-order and your first month is on us."; // TODO(launch): confirm or set to ""

export const quotes = [
  { text: "i solved a week for $41 and actually cooked all of it. nothing went bad.", name: "sam", city: "austin", date: "aug 2026" },
  { text: "two numbers in, a list out. i stopped standing in the aisle guessing.", name: "priya", city: "chicago", date: "aug 2026" },
  { text: "153 g a day for forty bucks. i didn't believe it until i kept the receipt.", name: "marcus", city: "denver", date: "aug 2026" },
]; // TODO(launch): SAMPLE QUOTES — replace with real ones or empty the array to hide the section
