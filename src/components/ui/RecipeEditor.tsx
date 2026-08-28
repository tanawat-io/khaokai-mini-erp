import type { Ingredient } from '@/domain/types';
import type { RecipeLineInput } from '@/domain/catalog';
import { Button } from './Button';
import { SearchableSelect } from './SearchableSelect';

// Shared recipe line editor for Menus and Add-ons — both are "ingredient + quantity" lines
// per DATABASE.md §11 / §12a. Quantities are always user-entered (BUSINESS_RULES.md §2/§4):
// no default portion is assumed for a new line.
export function RecipeEditor({
  recipe,
  ingredients,
  onChange,
}: {
  recipe: RecipeLineInput[];
  ingredients: Ingredient[];
  onChange: (recipe: RecipeLineInput[]) => void;
}) {
  function addLine() {
    const used = new Set(recipe.map((l) => l.ingredientId));
    const next = ingredients.find((i) => !used.has(i.id)) ?? ingredients[0];
    if (!next) return;
    onChange([...recipe, { ingredientId: next.id, quantity: 0 }]);
  }

  function updateLine(index: number, patch: Partial<RecipeLineInput>) {
    onChange(recipe.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    onChange(recipe.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {recipe.map((line, index) => {
        const ingredient = ingredients.find((i) => i.id === line.ingredientId);
        const options = [
          ...(!ingredient ? [{ value: line.ingredientId, label: '(วัตถุดิบถูกปิดใช้งาน)' }] : []),
          ...ingredients.map((i) => ({ value: i.id, label: i.name })),
        ];
        return (
          <div key={index} className="flex flex-col gap-2 rounded-md border border-warmgray-200 p-2 sm:flex-row sm:items-center sm:border-0 sm:p-0">
            <SearchableSelect
              className="sm:flex-1"
              value={line.ingredientId}
              onChange={(id) => updateLine(index, { ingredientId: id })}
              options={options}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="min-h-touch w-24 rounded-md border border-warmgray-300 px-2 text-[15px]"
                value={line.quantity}
                min={0}
                onFocus={(e) => e.target.select()}
                onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
              />
              <span className="w-10 text-sm text-warmgray-400">{ingredient?.baseUnit ?? ''}</span>
              <button
                type="button"
                className="ml-auto flex min-h-touch items-center px-2 text-sm text-danger-600 sm:ml-0"
                onClick={() => removeLine(index)}
              >
                ลบ
              </button>
            </div>
          </div>
        );
      })}
      <Button variant="secondary" size="sm" onClick={addLine}>
        + เพิ่มวัตถุดิบในสูตร
      </Button>
    </div>
  );
}
