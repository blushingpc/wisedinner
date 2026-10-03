// Original directions for variants that previously inherited contradictory base instructions.
// Temperature checks follow FDA Safe Food Handling and FoodSafety.gov's minimum-temperature chart:
// https://www.fda.gov/food/buy-store-serve-safe-food/safe-food-handling
// https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures
// These are authored directions, not cooking-test or package-label verification.
export const VARIANT_DIRECTIONS: Record<string, { steps: string[]; minutes?: number }> = {
  "greek-yogurt-parfait-with-berries-and-granola-plant": { steps: [
    "Stir the pea protein into the almond yogurt until smooth.",
    "Stir in the oats and let them soften in the yogurt.",
    "Thaw the berries according to their package instructions and layer them with the yogurt."
  ] },
  "greek-yogurt-parfait-with-berries-and-granola-oats": { steps: [
    "Stir the whey into the greek yogurt until smooth.",
    "Stir in the oats and let them soften in the yogurt.",
    "Thaw the berries according to their package instructions and layer them with the yogurt."
  ] },
  "protein-oatmeal-with-peanut-butter-and-banana-pea": { steps: [
    "Cook the oats in water according to the package instructions.",
    "Let the oats cool slightly, then stir in the pea protein until smooth.",
    "Top with sliced banana and the peanut butter."
  ] },
  "egg-white-and-veggie-scramble-with-toast-eggs": { steps: [
    "Heat the oil in a pan and cook the peppers and onions according to their package instructions.",
    "Whisk all four eggs, add them to the pan and scramble until firm and a food thermometer reads 160 F.",
    "Toast the bread and serve it alongside the scramble."
  ] },
  "egg-and-avocado-breakfast-wrap-corn": { steps: [
    "Whisk the eggs and egg whites and scramble them in a pan until firm and a food thermometer reads 160 F.",
    "Warm both corn tortillas according to their package instructions.",
    "Divide the scrambled eggs, sliced avocado and salsa between the tortillas."
  ] },
  "southwest-chicken-wrap-tofu": { steps: [
    "Drain the tofu, pat it dry, dice it and toss it with the taco seasoning.",
    "Brown the tofu in a nonstick pan. Drain and warm the black beans, then warm the tortilla.",
    "Fill the tortilla with tofu, beans, salsa and sliced avocado, then roll it up."
  ] },
  "chicken-burrito-bowl-tofu": { steps: [
    "Cook the rice according to its package instructions.",
    "Drain the tofu, pat it dry, dice it and toss it with the taco seasoning. Brown it in a nonstick pan.",
    "Drain and warm the black beans.",
    "Build the bowl with rice, tofu, beans, salsa and sliced avocado."
  ] },
  "chicken-burrito-bowl-quinoa": { steps: [
    "Rinse and cook the quinoa according to its package instructions.",
    "Dice the chicken, toss it with the taco seasoning and cook it in a nonstick pan until a food thermometer reads 165 F.",
    "Drain and warm the black beans.",
    "Build the bowl with quinoa, chicken, beans, salsa and sliced avocado."
  ] },
  "tuna-salad-wrap-chicken": { steps: [
    "Drain the canned chicken and mix it with the avocado and hummus.",
    "Wash and chop the romaine.",
    "Spread the chicken salad over the tortilla, add the romaine and roll it up."
  ] },
  "mediterranean-chicken-bowl-with-tzatziki-tofu": { steps: [
    "Rinse and cook the quinoa according to its package instructions.",
    "Drain the tofu, pat it dry, dice it and cook it in the oil until hot and lightly browned.",
    "Wash and chop the cucumber and tomato.",
    "Build the bowl with quinoa, tofu, vegetables and hummus."
  ] },
  "turkey-taco-bowl-lentil": { minutes: 35, steps: [
    "Rinse and cook the lentils in water according to their package instructions, then drain.",
    "Cook the rice according to its package instructions.",
    "Stir the taco seasoning into the cooked lentils. Drain and warm the black beans.",
    "Build the bowl with rice, lentils, beans and salsa."
  ] },
  "teriyaki-chicken-and-broccoli-rice-bowl-tofu": { steps: [
    "Cook the rice according to its package instructions.",
    "Drain the tofu, pat it dry, dice it and brown it in the oil.",
    "Cook the broccoli according to its package instructions, then toss it with the tofu and teriyaki sauce.",
    "Serve over the rice."
  ] },
  "teriyaki-chicken-and-broccoli-rice-bowl-quinoa": { steps: [
    "Rinse and cook the quinoa according to its package instructions.",
    "Dice the chicken and cook it in the oil until a food thermometer reads 165 F.",
    "Cook the broccoli according to its package instructions, then toss it with the chicken and teriyaki sauce.",
    "Serve over the quinoa."
  ] },
  "chicken-fajita-bowl-shrimp": { steps: [
    "Thaw the needed shrimp in the refrigerator ahead of cooking. Keep the rest frozen.",
    "Cook the rice according to its package instructions.",
    "Cook the peppers and onions in the oil according to their package instructions. Add the shrimp and taco seasoning and cook until the shrimp are pearly and opaque.",
    "Serve over the rice with salsa."
  ] },
  "sheet-pan-chicken-with-sweet-potato-and-broccoli-potatoes": { steps: [
    "Heat the oven to 425 F. Wash and cube the potatoes.",
    "Toss the potatoes with half the oil on a sheet pan and roast until starting to soften.",
    "Add the chicken and broccoli tossed in the remaining oil. Roast until the potatoes are tender, the broccoli is cooked according to its package and the chicken reaches 165 F on a food thermometer."
  ] },
  "pesto-chicken-pasta-shrimp": { steps: [
    "Thaw the needed shrimp in the refrigerator ahead of cooking. Keep the rest frozen.",
    "Cook the pasta and broccoli according to their package instructions, then drain.",
    "Cook the shrimp in a nonstick pan until pearly and opaque.",
    "Toss the pasta, broccoli and shrimp with the pesto and top with parmesan."
  ] },
  "pesto-chicken-pasta-gf": { steps: [
    "Cook the gluten free pasta and broccoli according to their package instructions, then drain.",
    "Dice the chicken and cook it in a nonstick pan until a food thermometer reads 165 F.",
    "Toss the pasta, broccoli and chicken with pesto and top with parmesan."
  ] },
  "turkey-meatballs-with-whole-wheat-spaghetti-beef": { steps: [
    "Mix the beef with breadcrumbs, egg and half the parmesan, then roll into meatballs.",
    "Brown the meatballs in a nonstick pan, add marinara and simmer until a food thermometer reads 160 F in the meatballs.",
    "Cook and drain the whole wheat spaghetti according to its package instructions.",
    "Serve the meatballs and sauce over the spaghetti with the remaining parmesan."
  ] },
  "turkey-meatballs-with-whole-wheat-spaghetti-gf": { steps: [
    "Crush the oats into crumbs. Mix them with turkey, egg and half the parmesan, then roll into meatballs.",
    "Brown the meatballs in a nonstick pan, add marinara and simmer until a food thermometer reads 165 F in the meatballs.",
    "Cook and drain the gluten free pasta according to its package instructions.",
    "Serve the meatballs and sauce over the pasta with the remaining parmesan. Check every package label for gluten."
  ] },
  "chicken-stir-fry-with-rice-tofu": { steps: [
    "Cook the rice according to its package instructions.",
    "Drain the tofu, pat it dry, slice it and brown it in the oil.",
    "Cook the vegetables according to their package instructions, then toss them with the tofu and soy sauce.",
    "Serve over the rice."
  ] },
  "bbq-chicken-with-roasted-vegetables-and-rice-pork": { steps: [
    "Heat the oven to 425 F. Toss the vegetables in the oil on a sheet pan.",
    "Add the pork and roast, brushing it with barbecue sauce near the end. Cook the vegetables according to their package and the pork to 145 F on a food thermometer.",
    "Rest the pork for at least 3 minutes before slicing. Cook the rice according to its package instructions and serve everything over it."
  ] },
  "buffalo-chicken-bowl-tempeh": { steps: [
    "Cook the rice according to its package instructions.",
    "Dice and cook the tempeh according to its package instructions, then toss it with buffalo sauce.",
    "Wash and chop the romaine, grate the carrot and slice the avocado.",
    "Build the bowl with rice, tempeh and vegetables."
  ] },
  "shrimp-and-veggie-stir-fry-brown-rice": { steps: [
    "Thaw the needed shrimp in the refrigerator ahead of cooking. Keep the rest frozen.",
    "Cook the brown rice according to its package instructions.",
    "Cook the vegetables and edamame in the oil according to their package instructions. Add the shrimp and cook until pearly and opaque, then add the soy sauce.",
    "Serve over the brown rice."
  ] },
  "salmon-with-rice-and-asparagus-tilapia": { steps: [
    "Thaw the needed tilapia in the refrigerator ahead of cooking. Keep the rest frozen.",
    "Cook the rice according to its package instructions. Heat the oven to 400 F.",
    "Wash and trim the asparagus and place it with the tilapia on a sheet pan drizzled with oil. Roast until the asparagus is tender and a food thermometer reads 145 F in the fish.",
    "Serve over the rice."
  ] }
};
