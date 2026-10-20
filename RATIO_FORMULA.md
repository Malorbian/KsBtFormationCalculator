# Ratio formula

The stat-based Bear ratio formula is intentionally isolated in:

`src/calculator/RatioCalculation.ts`

The block marked `RATIO FORMULA: EDIT HERE` is the place to change the final ratio maths later.

## Current formula

The composition-dependent Bear damage is modeled as proportional to:

```text
(1/3) * A_inf * sqrt(f_inf)
+ A_cav * sqrt(f_cav)
+ (4.4/3) * A_arc * sqrt(f_arc)
```

with:

```text
f_inf + f_cav + f_arc = 1
```

The Lagrange-multiplier solution gives weights:

```text
alpha = A_inf / 3
beta  = A_cav
gamma = 4.4 * A_arc / 3

f_inf = alpha^2 / (alpha^2 + beta^2 + gamma^2)
f_cav = beta^2  / (alpha^2 + beta^2 + gamma^2)
f_arc = gamma^2 / (alpha^2 + beta^2 + gamma^2)
```

The common `L` factor cancels from the ratio and is therefore not needed.

At the moment `A` is calculated in the separate `calculateAttackFactor(...)` method as:

```text
avgBaseAttack * (1 + attackBonus / 100)
* avgBaseLethality * (1 + lethalityBonus / 100)
```

That method is also isolated so it can be replaced independently if the exact definition of `A` changes.

## UI behaviour

- Default ratio: `1:20:79`.
- Ratio fields are editable manually.
- Stat inputs affect the ratio only while **Use my stats to calculate the ratio** is checked.
- Unchecking that checkbox keeps the last calculated values in the ratio fields.
- **Reset to 1:20:79** restores the default ratio and turns stat-based ratio calculation off.
- Ratios are stored internally as normalized fractions.

The march-filling rules are independent from the ratio formula and live in `src/calculator/MarchFiller.ts`.
