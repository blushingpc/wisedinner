// the 27 REDESIGN-V4 §4 dishes plus two variants each, one person-serving, sized for ~150 g protein a day.
import type { AuthoredRecipe } from "./types.ts";

export const RECIPES: AuthoredRecipe[] = [
  {
    id: "greek-yogurt-parfait-with-berries-and-granola",
    name: "Greek yogurt parfait with berries and granola",
    meal_type: "breakfast",
    protein: "greek yogurt",
    minutes: 5,
    ingredients: [
      ["greek-yogurt", 8, "oz"],
      ["whey-protein", 15, "g"],
      ["granola", 1.5, "oz"],
      ["frozen-berries", 3, "oz"],
    ],
    steps: [
      "Stir the whey into the yogurt until smooth.",
      "Layer the yogurt with the berries in a bowl or jar.",
      "Top with the granola and eat right away.",
    ],
    variants: [
      {
        id: "greek-yogurt-parfait-with-berries-and-granola-plant",
        name: "Almond yogurt parfait with berries and oats",
        kind: "protein_swap",
        protein: "pea protein",
        swap: {
          "greek-yogurt": ["plant-yogurt", 8, "oz"],
          "whey-protein": ["pea-protein", 35, "g"],
          granola: ["oats", 1.5, "oz"],
        },
      },
      {
        id: "greek-yogurt-parfait-with-berries-and-granola-oats",
        name: "Greek yogurt parfait with berries and oats",
        kind: "carb_swap",
        protein: "greek yogurt",
        swap: {
          granola: ["oats", 1.5, "oz"],
        },
      },
    ],
  },
  {
    id: "protein-oatmeal-with-peanut-butter-and-banana",
    name: "Protein oatmeal with peanut butter and banana",
    meal_type: "breakfast",
    protein: "whey",
    minutes: 10,
    ingredients: [
      ["oats", 60, "g"],
      ["whey-protein", 30, "g"],
      ["peanut-butter", 1, "oz"],
      ["bananas", 100, "g"],
    ],
    steps: [
      "Cook the oats in water on the stove or in the microwave until thick.",
      "Let it cool for a minute, then stir in the whey until smooth.",
      "Top with sliced banana and the peanut butter.",
    ],
    variants: [
      {
        id: "protein-oatmeal-with-peanut-butter-and-banana-pea",
        name: "Vegan protein oatmeal with peanut butter and banana",
        kind: "protein_swap",
        protein: "pea protein",
        swap: {
          "whey-protein": ["pea-protein", 30, "g"],
        },
      },
      {
        id: "protein-oatmeal-with-peanut-butter-and-banana-quinoa",
        name: "Protein quinoa porridge with peanut butter and banana",
        kind: "carb_swap",
        protein: "whey",
        minutes: 15,
        swap: {
          oats: ["quinoa", 50, "g"],
        },
        steps: [
          "Rinse the quinoa and simmer it in water for 15 minutes until soft.",
          "Let it cool for a minute, then stir in the whey until smooth.",
          "Top with sliced banana and the peanut butter.",
        ],
      },
    ],
  },
  {
    id: "egg-white-and-veggie-scramble-with-toast",
    name: "Egg white and veggie scramble with toast",
    meal_type: "breakfast",
    protein: "egg whites",
    minutes: 10,
    ingredients: [
      ["egg-whites", 10, "oz"],
      ["frozen-peppers-onions", 3, "oz"],
      ["ww-bread", 2, "oz"],
      ["olive-oil", 1, "tsp"],
    ],
    steps: [
      "Heat the oil in a pan and cook the peppers and onions until soft.",
      "Pour in the egg whites and stir gently until just set.",
      "Toast the bread and serve it alongside the scramble.",
    ],
    variants: [
      {
        id: "egg-white-and-veggie-scramble-with-toast-tofu",
        name: "Tofu and veggie scramble with toast",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          "egg-whites": ["tofu", 7, "oz"],
        },
        steps: [
          "Heat the oil in a pan and cook the peppers and onions until soft.",
          "Crumble in the tofu and cook until hot and lightly browned.",
          "Toast the bread and serve it alongside the scramble.",
        ],
      },
      {
        id: "egg-white-and-veggie-scramble-with-toast-potatoes",
        name: "Egg white and veggie scramble with potatoes",
        kind: "carb_swap",
        protein: "egg whites",
        minutes: 15,
        swap: {
          "ww-bread": ["russet-potatoes", 6, "oz"],
        },
        steps: [
          "Dice the potatoes and microwave them for 4 minutes until tender.",
          "Heat the oil in a pan and brown the potatoes with the peppers and onions.",
          "Pour in the egg whites and stir gently until just set.",
        ],
      },
    ],
  },
  {
    id: "protein-pancakes-with-berries",
    name: "Protein pancakes with berries",
    meal_type: "breakfast",
    protein: "whey",
    minutes: 15,
    ingredients: [
      ["pancake-mix", 60, "g"],
      ["eggs", 2, "each"],
      ["whey-protein", 20, "g"],
      ["frozen-berries", 3, "oz"],
    ],
    steps: [
      "Whisk the pancake mix, eggs and whey with a splash of water into a thick batter.",
      "Cook small pancakes in a hot nonstick pan for 2 minutes a side.",
      "Warm the berries in the microwave and spoon them over the top.",
    ],
    variants: [
      {
        id: "protein-pancakes-with-berries-vegan",
        name: "Vegan banana oat pancakes with berries",
        kind: "protein_swap",
        protein: "pea protein",
        swap: {
          "pancake-mix": ["oats", 60, "g"],
          eggs: ["bananas", 100, "g"],
          "whey-protein": ["pea-protein", 30, "g"],
        },
        steps: [
          "Blend the oats, banana and pea protein with a splash of water into a thick batter.",
          "Cook small pancakes in a hot nonstick pan for 3 minutes a side.",
          "Warm the berries in the microwave and spoon them over the top.",
        ],
      },
      {
        id: "protein-pancakes-with-berries-oat",
        name: "Oat protein pancakes with berries",
        kind: "carb_swap",
        protein: "whey",
        swap: {
          "pancake-mix": ["oats", 60, "g"],
        },
        steps: [
          "Blend the oats, eggs and whey with a splash of water into a thick batter.",
          "Cook small pancakes in a hot nonstick pan for 2 minutes a side.",
          "Warm the berries in the microwave and spoon them over the top.",
        ],
      },
    ],
  },
  {
    id: "egg-and-avocado-breakfast-wrap",
    name: "Egg and avocado breakfast wrap",
    meal_type: "breakfast",
    protein: "eggs",
    minutes: 10,
    ingredients: [
      ["eggs", 3, "each"],
      ["egg-whites", 5, "oz"],
      ["flour-tortillas", 1, "each"],
      ["avocados", 0.5, "each"],
      ["salsa", 1, "oz"],
    ],
    steps: [
      "Whisk the eggs and egg whites and scramble them in a hot pan.",
      "Warm the tortilla for 20 seconds in the pan or microwave.",
      "Fill with the eggs, sliced avocado and salsa, then roll it up.",
    ],
    variants: [
      {
        id: "egg-and-avocado-breakfast-wrap-tofu",
        name: "Tofu and avocado breakfast wrap",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          eggs: ["tofu", 7, "oz"],
          "egg-whites": null,
        },
        steps: [
          "Crumble the tofu into a hot pan and cook until lightly browned.",
          "Warm the tortilla for 20 seconds in the pan or microwave.",
          "Fill with the tofu, sliced avocado and salsa, then roll it up.",
        ],
      },
      {
        id: "egg-and-avocado-breakfast-wrap-corn",
        name: "Egg and avocado breakfast tacos",
        kind: "carb_swap",
        protein: "eggs",
        swap: {
          "flour-tortillas": ["corn-tortillas", 2, "each"],
        },
      },
    ],
  },
  {
    id: "cottage-cheese-bowl-with-fruit-and-honey",
    name: "Cottage cheese bowl with fruit and honey",
    meal_type: "breakfast",
    protein: "cottage cheese",
    minutes: 5,
    ingredients: [
      ["cottage-cheese", 11, "oz"],
      ["frozen-berries", 3, "oz"],
      ["bananas", 100, "g"],
      ["honey", 0.5, "oz"],
    ],
    steps: [
      "Spoon the cottage cheese into a bowl.",
      "Top with the berries and sliced banana.",
      "Drizzle the honey over the top.",
    ],
    variants: [
      {
        id: "cottage-cheese-bowl-with-fruit-and-honey-plant",
        name: "Vegan protein yogurt bowl with fruit and peanut butter",
        kind: "protein_swap",
        protein: "pea protein",
        swap: {
          "cottage-cheese": ["plant-yogurt", 8, "oz"],
          honey: ["peanut-butter", 1, "oz"],
        },
        add: [["pea-protein", 30, "g"]],
        steps: [
          "Stir the pea protein into the yogurt until smooth.",
          "Top with the berries and sliced banana.",
          "Spoon the peanut butter over the top.",
        ],
      },
      {
        id: "cottage-cheese-bowl-with-fruit-and-honey-toast",
        name: "Cottage cheese toast with berries and honey",
        kind: "carb_swap",
        protein: "cottage cheese",
        swap: {
          bananas: ["ww-bread", 2, "oz"],
        },
        steps: [
          "Toast the bread.",
          "Spread the cottage cheese over the toast and top with the berries.",
          "Drizzle the honey over the top.",
        ],
      },
    ],
  },
  {
    id: "chicken-caesar-wrap",
    name: "Chicken caesar wrap",
    meal_type: "lunch",
    protein: "chicken breast",
    minutes: 15,
    ingredients: [
      ["chicken-breast", 6, "oz"],
      ["flour-tortillas", 1, "each"],
      ["romaine", 0.5, "each"],
      ["caesar-dressing", 2, "tbsp"],
      ["parmesan", 0.5, "oz"],
    ],
    steps: [
      "Slice the chicken thin and cook it in a hot pan until no longer pink.",
      "Chop the romaine and toss it with the dressing and parmesan.",
      "Pile the chicken and salad onto the tortilla and roll it up.",
    ],
    variants: [
      {
        id: "chicken-caesar-wrap-turkey",
        name: "Turkey caesar wrap",
        kind: "protein_swap",
        protein: "deli turkey",
        minutes: 10,
        swap: {
          "chicken-breast": ["deli-turkey", 6, "oz"],
        },
        steps: [
          "Chop the romaine and toss it with the dressing and parmesan.",
          "Warm the tortilla for 20 seconds in the microwave.",
          "Layer the turkey and salad onto the tortilla and roll it up.",
        ],
      },
      {
        id: "chicken-caesar-wrap-bowl",
        name: "Chicken caesar bowl with rice",
        kind: "carb_swap",
        protein: "chicken breast",
        minutes: 20,
        swap: {
          "flour-tortillas": ["white-rice", 60, "g"],
        },
        steps: [
          "Cook the rice.",
          "Slice the chicken thin and cook it in a hot pan until no longer pink.",
          "Chop the romaine and toss it with the dressing and parmesan.",
          "Serve the chicken and salad over the rice.",
        ],
      },
    ],
  },
  {
    id: "southwest-chicken-wrap",
    name: "Southwest chicken wrap",
    meal_type: "lunch",
    protein: "chicken breast",
    minutes: 15,
    ingredients: [
      ["chicken-breast", 5, "oz"],
      ["flour-tortillas", 1, "each"],
      ["black-beans", 3, "oz"],
      ["salsa", 1, "oz"],
      ["taco-seasoning", 5, "g"],
      ["avocados", 0.5, "each"],
    ],
    steps: [
      "Dice the chicken, toss it with the taco seasoning and cook it in a hot pan.",
      "Warm the black beans and the tortilla.",
      "Fill the tortilla with the chicken, beans, salsa and sliced avocado, then roll it up.",
    ],
    variants: [
      {
        id: "southwest-chicken-wrap-tofu",
        name: "Southwest tofu wrap",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          "chicken-breast": ["tofu", 7, "oz"],
        },
      },
      {
        id: "southwest-chicken-wrap-corn",
        name: "Southwest chicken tacos",
        kind: "carb_swap",
        protein: "chicken breast",
        swap: {
          "flour-tortillas": ["corn-tortillas", 3, "each"],
        },
        steps: [
          "Dice the chicken, toss it with the taco seasoning and cook it in a hot pan.",
          "Warm the black beans and the tortillas.",
          "Fill the tortillas with the chicken, beans, salsa and sliced avocado.",
        ],
      },
    ],
  },
  {
    id: "chicken-burrito-bowl",
    name: "Chicken burrito bowl",
    meal_type: "lunch",
    protein: "chicken breast",
    minutes: 20,
    ingredients: [
      ["chicken-breast", 6, "oz"],
      ["white-rice", 60, "g"],
      ["black-beans", 3, "oz"],
      ["salsa", 2, "oz"],
      ["taco-seasoning", 5, "g"],
      ["avocados", 0.5, "each"],
    ],
    steps: [
      "Cook the rice.",
      "Dice the chicken, toss it with the taco seasoning and cook it in a hot pan.",
      "Warm the black beans.",
      "Build the bowl with rice, chicken, beans, salsa and sliced avocado.",
    ],
    variants: [
      {
        id: "chicken-burrito-bowl-tofu",
        name: "Tofu burrito bowl",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          "chicken-breast": ["tofu", 7, "oz"],
        },
      },
      {
        id: "chicken-burrito-bowl-quinoa",
        name: "Chicken burrito bowl with quinoa",
        kind: "carb_swap",
        protein: "chicken breast",
        swap: {
          "white-rice": ["quinoa", 50, "g"],
        },
      },
    ],
  },
  {
    id: "turkey-and-avocado-sandwich-on-whole-wheat",
    name: "Turkey and avocado sandwich on whole wheat",
    meal_type: "lunch",
    protein: "deli turkey",
    minutes: 10,
    ingredients: [
      ["deli-turkey", 7, "oz"],
      ["ww-bread", 2, "oz"],
      ["avocados", 0.5, "each"],
      ["tomatoes", 2, "oz"],
      ["hummus", 1, "oz"],
    ],
    steps: [
      "Toast the bread and spread it with the hummus.",
      "Slice the avocado and tomato.",
      "Stack the turkey, avocado and tomato between the slices.",
    ],
    variants: [
      {
        id: "turkey-and-avocado-sandwich-on-whole-wheat-tempeh",
        name: "Tempeh and avocado sandwich on whole wheat",
        kind: "protein_swap",
        protein: "tempeh",
        minutes: 15,
        swap: {
          "deli-turkey": ["tempeh", 6, "oz"],
        },
        steps: [
          "Slice the tempeh into thin slabs and pan sear them in a hot pan until golden.",
          "Toast the bread and spread it with the hummus.",
          "Stack the tempeh, sliced avocado and tomato between the slices.",
        ],
      },
      {
        id: "turkey-and-avocado-sandwich-on-whole-wheat-wrap",
        name: "Turkey and avocado wrap",
        kind: "carb_swap",
        protein: "deli turkey",
        swap: {
          "ww-bread": ["flour-tortillas", 1, "each"],
        },
        steps: [
          "Spread the hummus over the tortilla.",
          "Slice the avocado and tomato.",
          "Layer the turkey, avocado and tomato on top and roll it up.",
        ],
      },
    ],
  },
  {
    id: "tuna-salad-wrap",
    name: "Tuna salad wrap",
    meal_type: "lunch",
    protein: "tuna",
    minutes: 10,
    ingredients: [
      ["canned-tuna", 5, "oz"],
      ["avocados", 0.5, "each"],
      ["hummus", 1, "oz"],
      ["flour-tortillas", 1, "each"],
      ["romaine", 0.25, "each"],
    ],
    steps: [
      "Drain the tuna and mash it with the avocado and hummus.",
      "Chop the romaine.",
      "Spread the tuna salad over the tortilla, add the romaine and roll it up.",
    ],
    variants: [
      {
        id: "tuna-salad-wrap-chicken",
        name: "Chicken salad wrap",
        kind: "protein_swap",
        protein: "canned chicken",
        swap: {
          "canned-tuna": ["canned-chicken", 6, "oz"],
        },
      },
      {
        id: "tuna-salad-wrap-rice",
        name: "Tuna and avocado rice bowl",
        kind: "carb_swap",
        protein: "tuna",
        minutes: 20,
        swap: {
          "flour-tortillas": ["white-rice", 60, "g"],
        },
        steps: [
          "Cook the rice.",
          "Drain the tuna and mash it with the avocado and hummus.",
          "Serve the tuna salad over the rice with the chopped romaine.",
        ],
      },
    ],
  },
  {
    id: "mediterranean-chicken-bowl-with-tzatziki",
    name: "Mediterranean chicken bowl with tzatziki",
    meal_type: "lunch",
    protein: "chicken breast",
    minutes: 20,
    ingredients: [
      ["chicken-breast", 6, "oz"],
      ["quinoa", 60, "g"],
      ["tzatziki", 2, "oz"],
      ["cucumber", 0.25, "each"],
      ["tomatoes", 2, "oz"],
      ["olive-oil", 1, "tsp"],
    ],
    steps: [
      "Rinse the quinoa and simmer it in water for 15 minutes until soft.",
      "Dice the chicken and cook it in the oil until no longer pink.",
      "Chop the cucumber and tomato.",
      "Build the bowl with quinoa, chicken, vegetables and a spoon of tzatziki.",
    ],
    variants: [
      {
        id: "mediterranean-chicken-bowl-with-tzatziki-tofu",
        name: "Mediterranean tofu bowl with hummus",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          "chicken-breast": ["tofu", 7, "oz"],
          tzatziki: ["hummus", 2, "oz"],
        },
      },
      {
        id: "mediterranean-chicken-bowl-with-tzatziki-wrap",
        name: "Mediterranean chicken wrap with tzatziki",
        kind: "carb_swap",
        protein: "chicken breast",
        minutes: 15,
        swap: {
          quinoa: ["flour-tortillas", 1, "each"],
        },
        steps: [
          "Dice the chicken and cook it in the oil until no longer pink.",
          "Chop the cucumber and tomato.",
          "Spread the tzatziki over the tortilla, add the chicken and vegetables and roll it up.",
        ],
      },
    ],
  },
  {
    id: "turkey-taco-bowl",
    name: "Turkey taco bowl",
    meal_type: "lunch",
    protein: "ground turkey",
    minutes: 20,
    ingredients: [
      ["ground-turkey", 6, "oz"],
      ["white-rice", 60, "g"],
      ["black-beans", 4, "oz"],
      ["taco-seasoning", 7, "g"],
      ["salsa", 2, "oz"],
    ],
    steps: [
      "Cook the rice.",
      "Brown the turkey in a hot pan and stir in the taco seasoning.",
      "Warm the black beans.",
      "Build the bowl with rice, turkey, beans and salsa.",
    ],
    variants: [
      {
        id: "turkey-taco-bowl-beef",
        name: "Beef taco bowl",
        kind: "protein_swap",
        protein: "ground beef",
        swap: {
          "ground-turkey": ["ground-beef", 6, "oz"],
        },
      },
      {
        id: "turkey-taco-bowl-tacos",
        name: "Turkey tacos",
        kind: "carb_swap",
        protein: "ground turkey",
        minutes: 15,
        swap: {
          "white-rice": ["corn-tortillas", 3, "each"],
        },
        steps: [
          "Brown the turkey in a hot pan and stir in the taco seasoning.",
          "Warm the black beans and the tortillas.",
          "Fill the tortillas with the turkey, beans and salsa.",
        ],
      },
    ],
  },
  {
    id: "teriyaki-chicken-and-broccoli-rice-bowl",
    name: "Teriyaki chicken and broccoli rice bowl",
    meal_type: "dinner",
    protein: "chicken breast",
    minutes: 25,
    ingredients: [
      ["chicken-breast", 8, "oz"],
      ["white-rice", 65, "g"],
      ["frozen-broccoli", 4, "oz"],
      ["teriyaki-sauce", 2, "tbsp"],
      ["olive-oil", 1, "tsp"],
    ],
    steps: [
      "Cook the rice.",
      "Dice the chicken and cook it in the oil until browned.",
      "Add the broccoli and teriyaki sauce and cook until the broccoli is hot and the sauce is sticky.",
      "Serve over the rice.",
    ],
    variants: [
      {
        id: "teriyaki-chicken-and-broccoli-rice-bowl-tofu",
        name: "Teriyaki tofu and broccoli rice bowl",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          "chicken-breast": ["tofu", 9, "oz"],
        },
      },
      {
        id: "teriyaki-chicken-and-broccoli-rice-bowl-quinoa",
        name: "Teriyaki chicken and broccoli quinoa bowl",
        kind: "carb_swap",
        protein: "chicken breast",
        swap: {
          "white-rice": ["quinoa", 60, "g"],
        },
      },
    ],
  },
  {
    id: "chicken-fajita-bowl",
    name: "Chicken fajita bowl",
    meal_type: "dinner",
    protein: "chicken breast",
    minutes: 25,
    ingredients: [
      ["chicken-breast", 7, "oz"],
      ["frozen-peppers-onions", 5, "oz"],
      ["white-rice", 60, "g"],
      ["taco-seasoning", 7, "g"],
      ["salsa", 2, "oz"],
      ["olive-oil", 1, "tsp"],
    ],
    steps: [
      "Cook the rice.",
      "Slice the chicken into strips and toss it with the taco seasoning.",
      "Cook the chicken in the oil over high heat, then add the peppers and onions and cook until charred.",
      "Serve over the rice with the salsa.",
    ],
    variants: [
      {
        id: "chicken-fajita-bowl-shrimp",
        name: "Shrimp fajita bowl",
        kind: "protein_swap",
        protein: "shrimp",
        swap: {
          "chicken-breast": ["frozen-shrimp", 8, "oz"],
        },
      },
      {
        id: "chicken-fajita-bowl-tortillas",
        name: "Chicken fajitas with flour tortillas",
        kind: "carb_swap",
        protein: "chicken breast",
        swap: {
          "white-rice": ["flour-tortillas", 2, "each"],
        },
        steps: [
          "Slice the chicken into strips and toss it with the taco seasoning.",
          "Cook the chicken in the oil over high heat, then add the peppers and onions and cook until charred.",
          "Warm the tortillas and fill them with the chicken, vegetables and salsa.",
        ],
      },
    ],
  },
  {
    id: "sheet-pan-chicken-with-sweet-potato-and-broccoli",
    name: "Sheet pan chicken with sweet potato and broccoli",
    meal_type: "dinner",
    protein: "chicken breast",
    minutes: 35,
    ingredients: [
      ["chicken-breast", 8, "oz"],
      ["sweet-potatoes", 8, "oz"],
      ["frozen-broccoli", 4, "oz"],
      ["olive-oil", 1, "tbsp"],
    ],
    steps: [
      "Heat the oven to 425 F and cube the sweet potato.",
      "Toss the sweet potato with half the oil on a sheet pan and roast for 15 minutes.",
      "Add the chicken and broccoli tossed in the rest of the oil and roast 15 minutes more.",
    ],
    variants: [
      {
        id: "sheet-pan-chicken-with-sweet-potato-and-broccoli-tofu",
        name: "Sheet pan tofu with sweet potato and broccoli",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          "chicken-breast": ["tofu", 9, "oz"],
        },
        steps: [
          "Heat the oven to 425 F, cube the sweet potato and press and cube the tofu.",
          "Toss the sweet potato with half the oil on a sheet pan and roast for 15 minutes.",
          "Add the tofu and broccoli tossed in the rest of the oil and roast 15 minutes more.",
        ],
      },
      {
        id: "sheet-pan-chicken-with-sweet-potato-and-broccoli-potatoes",
        name: "Sheet pan chicken with potatoes and broccoli",
        kind: "carb_swap",
        protein: "chicken breast",
        swap: {
          "sweet-potatoes": ["russet-potatoes", 8, "oz"],
        },
      },
    ],
  },
  {
    id: "turkey-chili",
    name: "Turkey chili",
    meal_type: "dinner",
    protein: "ground turkey",
    minutes: 30,
    ingredients: [
      ["ground-turkey", 8, "oz"],
      ["kidney-beans", 4, "oz"],
      ["canned-tomatoes", 7, "oz"],
      ["onions", 2, "oz"],
      ["bell-peppers", 0.5, "each"],
      ["taco-seasoning", 10, "g"],
    ],
    steps: [
      "Chop the onion and pepper and cook them in a pot until soft.",
      "Add the turkey and brown it, then stir in the taco seasoning.",
      "Add the tomatoes and beans and simmer for 15 minutes.",
    ],
    variants: [
      {
        id: "turkey-chili-lentil",
        name: "Lentil chili",
        kind: "protein_swap",
        protein: "lentils",
        minutes: 35,
        swap: {
          "ground-turkey": ["lentils", 130, "g"],
          "kidney-beans": ["kidney-beans", 5, "oz"],
        },
        steps: [
          "Chop the onion and pepper and cook them in a pot until soft.",
          "Stir in the taco seasoning, lentils, tomatoes and two cups of water.",
          "Simmer for 25 minutes until the lentils are tender, then add the beans and heat through.",
        ],
      },
      {
        id: "turkey-chili-potato",
        name: "Turkey chili over a baked potato",
        kind: "carb_swap",
        protein: "ground turkey",
        minutes: 35,
        swap: {
          "kidney-beans": ["russet-potatoes", 8, "oz"],
        },
        steps: [
          "Prick the potato and microwave it for 8 minutes until soft.",
          "Chop the onion and pepper and cook them in a pot until soft.",
          "Add the turkey and brown it, then stir in the taco seasoning and tomatoes and simmer for 15 minutes.",
          "Split the potato and spoon the chili over it.",
        ],
      },
    ],
  },
  {
    id: "pesto-chicken-pasta",
    name: "Pesto chicken pasta",
    meal_type: "dinner",
    protein: "chicken breast",
    minutes: 25,
    ingredients: [
      ["chicken-breast", 6, "oz"],
      ["penne", 70, "g"],
      ["pesto", 2, "oz"],
      ["frozen-broccoli", 3, "oz"],
      ["parmesan", 0.5, "oz"],
    ],
    steps: [
      "Boil the pasta, adding the broccoli for the last 3 minutes, then drain.",
      "Dice the chicken and cook it in a hot pan until no longer pink.",
      "Toss the pasta, broccoli and chicken with the pesto and top with parmesan.",
    ],
    variants: [
      {
        id: "pesto-chicken-pasta-shrimp",
        name: "Pesto shrimp pasta",
        kind: "protein_swap",
        protein: "shrimp",
        swap: {
          "chicken-breast": ["frozen-shrimp", 7, "oz"],
        },
      },
      {
        id: "pesto-chicken-pasta-gf",
        name: "Gluten free pesto chicken pasta",
        kind: "carb_swap",
        protein: "chicken breast",
        swap: {
          penne: ["gf-pasta", 70, "g"],
        },
      },
    ],
  },
  {
    id: "turkey-meatballs-with-whole-wheat-spaghetti",
    name: "Turkey meatballs with whole wheat spaghetti",
    meal_type: "dinner",
    protein: "ground turkey",
    minutes: 35,
    ingredients: [
      ["ground-turkey", 7, "oz"],
      ["ww-spaghetti", 70, "g"],
      ["marinara", 4, "oz"],
      ["breadcrumbs", 0.5, "oz"],
      ["eggs", 1, "each"],
      ["parmesan", 0.5, "oz"],
    ],
    steps: [
      "Mix the turkey with the breadcrumbs, egg and half the parmesan and roll into meatballs.",
      "Brown the meatballs in a pan, add the marinara and simmer for 12 minutes.",
      "Boil the spaghetti and drain.",
      "Serve the meatballs and sauce over the spaghetti with the rest of the parmesan.",
    ],
    variants: [
      {
        id: "turkey-meatballs-with-whole-wheat-spaghetti-beef",
        name: "Beef meatballs with whole wheat spaghetti",
        kind: "protein_swap",
        protein: "ground beef",
        swap: {
          "ground-turkey": ["ground-beef", 7, "oz"],
        },
      },
      {
        id: "turkey-meatballs-with-whole-wheat-spaghetti-gf",
        name: "Turkey meatballs with gluten free spaghetti",
        kind: "carb_swap",
        protein: "ground turkey",
        swap: {
          "ww-spaghetti": ["gf-pasta", 70, "g"],
          breadcrumbs: ["oats", 0.5, "oz"],
        },
      },
    ],
  },
  {
    id: "chicken-stir-fry-with-rice",
    name: "Chicken stir-fry with rice",
    meal_type: "dinner",
    protein: "chicken breast",
    minutes: 25,
    ingredients: [
      ["chicken-breast", 8, "oz"],
      ["frozen-stirfry-veg", 5, "oz"],
      ["white-rice", 65, "g"],
      ["soy-sauce", 2, "tbsp"],
      ["olive-oil", 1, "tbsp"],
    ],
    steps: [
      "Cook the rice.",
      "Slice the chicken thin and cook it in the oil over high heat until browned.",
      "Add the vegetables and stir fry until hot, then add the soy sauce.",
      "Serve over the rice.",
    ],
    variants: [
      {
        id: "chicken-stir-fry-with-rice-tofu",
        name: "Tofu stir-fry with rice",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          "chicken-breast": ["tofu", 9, "oz"],
        },
      },
      {
        id: "chicken-stir-fry-with-rice-noodles",
        name: "Chicken stir-fry noodles",
        kind: "carb_swap",
        protein: "chicken breast",
        swap: {
          "white-rice": ["spaghetti", 70, "g"],
        },
        steps: [
          "Boil the spaghetti and drain.",
          "Slice the chicken thin and cook it in the oil over high heat until browned.",
          "Add the vegetables and stir fry until hot, then add the soy sauce.",
          "Toss the noodles through the pan and serve.",
        ],
      },
    ],
  },
  {
    id: "healthier-chicken-parmesan",
    name: "Healthier chicken parmesan",
    meal_type: "dinner",
    protein: "chicken breast",
    minutes: 35,
    ingredients: [
      ["chicken-breast", 6, "oz"],
      ["breadcrumbs", 1, "oz"],
      ["eggs", 1, "each"],
      ["marinara", 4, "oz"],
      ["shredded-mozzarella", 1, "oz"],
      ["frozen-broccoli", 4, "oz"],
    ],
    steps: [
      "Heat the oven to 425 F and flatten the chicken to an even thickness.",
      "Dip the chicken in the beaten egg, then coat it in the breadcrumbs.",
      "Bake on a rack for 18 minutes, then top with marinara and mozzarella and bake 5 minutes more.",
      "Steam the broccoli and serve alongside.",
    ],
    variants: [
      {
        id: "healthier-chicken-parmesan-tofu",
        name: "Healthier tofu parmesan",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          "chicken-breast": ["tofu", 8, "oz"],
        },
        steps: [
          "Heat the oven to 425 F, press the tofu and slice it into thick slabs.",
          "Dip the tofu in the beaten egg, then coat it in the breadcrumbs.",
          "Bake on a rack for 20 minutes, then top with marinara and mozzarella and bake 5 minutes more.",
          "Steam the broccoli and serve alongside.",
        ],
      },
      {
        id: "healthier-chicken-parmesan-oat",
        name: "Healthier chicken parmesan with oat crust",
        kind: "carb_swap",
        protein: "chicken breast",
        swap: {
          breadcrumbs: ["oats", 1, "oz"],
        },
        steps: [
          "Heat the oven to 425 F, flatten the chicken and pulse the oats into coarse crumbs.",
          "Dip the chicken in the beaten egg, then coat it in the oat crumbs.",
          "Bake on a rack for 18 minutes, then top with marinara and mozzarella and bake 5 minutes more.",
          "Steam the broccoli and serve alongside.",
        ],
      },
    ],
  },
  {
    id: "turkey-burgers-with-sweet-potato-wedges",
    name: "Turkey burgers with sweet potato wedges",
    meal_type: "dinner",
    protein: "ground turkey",
    minutes: 35,
    ingredients: [
      ["ground-turkey", 8, "oz"],
      ["ww-buns", 1, "each"],
      ["sweet-potatoes", 8, "oz"],
      ["olive-oil", 1, "tbsp"],
      ["romaine", 0.25, "each"],
    ],
    steps: [
      "Heat the oven to 425 F, cut the sweet potato into wedges, toss with the oil and roast for 25 minutes.",
      "Shape the turkey into two patties and cook them in a hot pan for 5 minutes a side.",
      "Serve the patties on the bun with the romaine and the wedges on the side.",
    ],
    variants: [
      {
        id: "turkey-burgers-with-sweet-potato-wedges-tempeh",
        name: "Tempeh burgers with sweet potato wedges",
        kind: "protein_swap",
        protein: "tempeh",
        swap: {
          "ground-turkey": ["tempeh", 8, "oz"],
        },
        steps: [
          "Heat the oven to 425 F, cut the sweet potato into wedges, toss with the oil and roast for 25 minutes.",
          "Slice the tempeh into two thick slabs and pan sear them for 4 minutes a side until golden.",
          "Serve the tempeh on the bun with the romaine and the wedges on the side.",
        ],
      },
      {
        id: "turkey-burgers-with-sweet-potato-wedges-bunless",
        name: "Bunless turkey burgers with sweet potato wedges",
        kind: "carb_swap",
        protein: "ground turkey",
        swap: {
          "ww-buns": null,
        },
        steps: [
          "Heat the oven to 425 F, cut the sweet potato into wedges, toss with the oil and roast for 25 minutes.",
          "Shape the turkey into two patties and cook them in a hot pan for 5 minutes a side.",
          "Serve the patties over the romaine with the wedges on the side.",
        ],
      },
    ],
  },
  {
    id: "ground-turkey-lettuce-wraps",
    name: "Ground turkey lettuce wraps",
    meal_type: "dinner",
    protein: "ground turkey",
    minutes: 25,
    ingredients: [
      ["ground-turkey", 8, "oz"],
      ["romaine", 0.5, "each"],
      ["carrots", 2, "oz"],
      ["frozen-edamame", 3, "oz"],
      ["soy-sauce", 2, "tbsp"],
      ["olive-oil", 1, "tsp"],
    ],
    steps: [
      "Brown the turkey in the oil in a hot pan.",
      "Grate the carrot and add it with the edamame and soy sauce, then cook until hot.",
      "Separate the romaine leaves and spoon the filling into them.",
    ],
    variants: [
      {
        id: "ground-turkey-lettuce-wraps-tofu",
        name: "Tofu lettuce wraps",
        kind: "protein_swap",
        protein: "tofu",
        swap: {
          "ground-turkey": ["tofu", 9, "oz"],
        },
        steps: [
          "Crumble the tofu into the oil in a hot pan and cook until lightly browned.",
          "Grate the carrot and add it with the edamame and soy sauce, then cook until hot.",
          "Separate the romaine leaves and spoon the filling into them.",
        ],
      },
      {
        id: "ground-turkey-lettuce-wraps-rice",
        name: "Ground turkey and edamame rice bowl",
        kind: "carb_swap",
        protein: "ground turkey",
        swap: {
          romaine: ["white-rice", 65, "g"],
        },
        steps: [
          "Cook the rice.",
          "Brown the turkey in the oil in a hot pan.",
          "Grate the carrot and add it with the edamame and soy sauce, then cook until hot.",
          "Serve over the rice.",
        ],
      },
    ],
  },
  {
    id: "bbq-chicken-with-roasted-vegetables-and-rice",
    name: "BBQ chicken with roasted vegetables and rice",
    meal_type: "dinner",
    protein: "chicken thighs",
    minutes: 35,
    ingredients: [
      ["chicken-thighs", 8, "oz"],
      ["white-rice", 70, "g"],
      ["frozen-mixed-veg", 5, "oz"],
      ["bbq-sauce", 2, "oz"],
      ["olive-oil", 1, "tsp"],
    ],
    steps: [
      "Heat the oven to 425 F and roast the chicken on a sheet pan for 20 minutes.",
      "Brush the chicken with the barbecue sauce, add the vegetables tossed in the oil and roast 10 minutes more.",
      "Cook the rice and serve everything over it.",
    ],
    variants: [
      {
        id: "bbq-chicken-with-roasted-vegetables-and-rice-pork",
        name: "BBQ pork loin with roasted vegetables and rice",
        kind: "protein_swap",
        protein: "pork loin",
        swap: {
          "chicken-thighs": ["pork-loin", 8, "oz"],
        },
      },
      {
        id: "bbq-chicken-with-roasted-vegetables-and-rice-potatoes",
        name: "BBQ chicken with roasted vegetables and potatoes",
        kind: "carb_swap",
        protein: "chicken thighs",
        swap: {
          "white-rice": ["russet-potatoes", 8, "oz"],
        },
        steps: [
          "Heat the oven to 425 F, cube the potatoes and toss them in the oil on a sheet pan with the chicken.",
          "Roast for 20 minutes.",
          "Brush the chicken with the barbecue sauce, add the vegetables and roast 10 minutes more.",
        ],
      },
    ],
  },
  {
    id: "buffalo-chicken-bowl",
    name: "Buffalo chicken bowl",
    meal_type: "dinner",
    protein: "chicken breast",
    minutes: 25,
    ingredients: [
      ["chicken-breast", 8, "oz"],
      ["white-rice", 60, "g"],
      ["buffalo-sauce", 2, "tbsp"],
      ["romaine", 0.25, "each"],
      ["carrots", 2, "oz"],
      ["avocados", 0.5, "each"],
    ],
    steps: [
      "Cook the rice.",
      "Dice the chicken and cook it in a hot pan until browned, then toss with the buffalo sauce.",
      "Chop the romaine, grate the carrot and slice the avocado.",
      "Build the bowl with rice, chicken and the vegetables.",
    ],
    variants: [
      {
        id: "buffalo-chicken-bowl-tempeh",
        name: "Buffalo tempeh bowl",
        kind: "protein_swap",
        protein: "tempeh",
        swap: {
          "chicken-breast": ["tempeh", 8, "oz"],
        },
      },
      {
        id: "buffalo-chicken-bowl-sweet-potato",
        name: "Buffalo chicken and sweet potato bowl",
        kind: "carb_swap",
        protein: "chicken breast",
        minutes: 30,
        swap: {
          "white-rice": ["sweet-potatoes", 8, "oz"],
        },
        steps: [
          "Cube the sweet potato and microwave it for 6 minutes until tender.",
          "Dice the chicken and cook it in a hot pan until browned, then toss with the buffalo sauce.",
          "Chop the romaine, grate the carrot and slice the avocado.",
          "Build the bowl with sweet potato, chicken and the vegetables.",
        ],
      },
    ],
  },
  {
    id: "shrimp-and-veggie-stir-fry",
    name: "Shrimp and veggie stir-fry",
    meal_type: "dinner",
    protein: "shrimp",
    minutes: 20,
    ingredients: [
      ["frozen-shrimp", 8, "oz"],
      ["frozen-stirfry-veg", 6, "oz"],
      ["white-rice", 65, "g"],
      ["frozen-edamame", 2, "oz"],
      ["soy-sauce", 2, "tbsp"],
      ["olive-oil", 1, "tbsp"],
    ],
    steps: [
      "Cook the rice.",
      "Cook the vegetables and edamame in the oil over high heat until hot.",
      "Add the shrimp and cook until pink, then add the soy sauce.",
      "Serve over the rice.",
    ],
    variants: [
      {
        id: "shrimp-and-veggie-stir-fry-pork",
        name: "Pork and veggie stir-fry",
        kind: "protein_swap",
        protein: "pork loin",
        minutes: 25,
        swap: {
          "frozen-shrimp": ["pork-loin", 8, "oz"],
        },
        steps: [
          "Cook the rice.",
          "Slice the pork thin and cook it in the oil over high heat until browned.",
          "Add the vegetables and edamame and stir fry until hot, then add the soy sauce.",
          "Serve over the rice.",
        ],
      },
      {
        id: "shrimp-and-veggie-stir-fry-brown-rice",
        name: "Shrimp and veggie stir-fry with brown rice",
        kind: "carb_swap",
        protein: "shrimp",
        minutes: 35,
        swap: {
          "white-rice": ["brown-rice", 65, "g"],
        },
      },
    ],
  },
  {
    id: "salmon-with-rice-and-asparagus",
    name: "Salmon with rice and asparagus",
    meal_type: "dinner",
    protein: "salmon",
    minutes: 25,
    ingredients: [
      ["frozen-salmon", 8, "oz"],
      ["white-rice", 65, "g"],
      ["asparagus", 5, "oz"],
      ["olive-oil", 2, "tsp"],
    ],
    steps: [
      "Cook the rice.",
      "Heat the oven to 400 F and lay the salmon and asparagus on a sheet pan drizzled with the oil.",
      "Roast for 15 minutes until the salmon flakes.",
      "Serve over the rice.",
    ],
    variants: [
      {
        id: "salmon-with-rice-and-asparagus-tilapia",
        name: "Tilapia with rice and asparagus",
        kind: "protein_swap",
        protein: "tilapia",
        swap: {
          "frozen-salmon": ["frozen-tilapia", 8, "oz"],
        },
      },
      {
        id: "salmon-with-rice-and-asparagus-sweet-potato",
        name: "Salmon with sweet potato and asparagus",
        kind: "carb_swap",
        protein: "salmon",
        minutes: 30,
        swap: {
          "white-rice": ["sweet-potatoes", 8, "oz"],
        },
        steps: [
          "Heat the oven to 400 F, cube the sweet potato, toss it with half the oil and roast for 15 minutes.",
          "Add the salmon and asparagus drizzled with the rest of the oil.",
          "Roast for 15 minutes more until the salmon flakes.",
        ],
      },
    ],
  },
];
