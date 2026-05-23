'use client';

import type {
  AIRecognitionResult,
  BaseServiceName,
  NailAddonName,
  NailShape,
  NailStyleName
} from '@/domain/nail';
import { ChipButton } from '@/components/ui/ChipButton';

const baseServiceOptions: Array<{ label: string; value: BaseServiceName }> = [
  { label: 'Removal', value: 'removal' },
  { label: 'Extension', value: 'extension' },
  { label: 'Builder gel', value: 'builderGel' }
];

const shapeOptions: Array<{ label: string; value: NailShape }> = [
  { label: 'Round', value: 'round' },
  { label: 'Square', value: 'square' },
  { label: 'Squoval', value: 'squoval' },
  { label: 'Oval', value: 'oval' },
  { label: 'Almond', value: 'almond' },
  { label: 'Coffin', value: 'coffin' },
  { label: 'Stiletto', value: 'stiletto' }
];

const styleOptions: Array<{ label: string; value: NailStyleName }> = [
  { label: 'Solid', value: 'solid' },
  { label: 'French', value: 'french' },
  { label: 'Cat eye', value: 'catEye' },
  { label: 'Chrome', value: 'chrome' },
  { label: 'Rhinestone', value: 'rhinestone' }
];

const addonOptions: Array<{ label: string; value: NailAddonName }> = [
  { label: 'Rhinestone', value: 'rhinestone' },
  { label: 'Charms', value: 'charms' },
  { label: 'Glitter', value: 'glitter' }
];

type NailAttributeEditorProps = {
  onChange: (nextValue: AIRecognitionResult) => void;
  value: AIRecognitionResult;
};

export function NailAttributeEditor({ onChange, value }: NailAttributeEditorProps) {
  function updateSelection(nextSelection: Partial<AIRecognitionResult['selection']>) {
    onChange({
      ...value,
      selection: {
        ...value.selection,
        ...nextSelection
      }
    });
  }

  function toggleArrayValue<K extends 'addons' | 'baseServices' | 'styles'>(
    key: K,
    item: AIRecognitionResult['selection'][K][number]
  ) {
    const currentItems = [...value.selection[key]] as string[];
    const nextItem = String(item);
    const hasItem = currentItems.includes(nextItem);

    // 中文注释：保持 selection 的单一更新入口，避免不同 section 各自复制嵌套对象展开逻辑。
    updateSelection({
      [key]: hasItem
        ? currentItems.filter((currentItem) => currentItem !== nextItem)
        : [...currentItems, nextItem]
    } as Pick<AIRecognitionResult['selection'], K>);
  }

  return (
    <div className="attribute-editor">
      <section>
        <h3>Base services</h3>
        <div className="chip-row">
          {baseServiceOptions.map((option) => (
            <ChipButton
              key={option.value}
              label={option.label}
              selected={value.selection.baseServices.includes(option.value)}
              onClick={() => toggleArrayValue('baseServices', option.value)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3>Nail shape</h3>
        <div className="chip-row">
          {shapeOptions.map((option) => (
            <ChipButton
              key={option.value}
              label={option.label}
              selected={value.selection.nailShape === option.value}
              onClick={() => updateSelection({ nailShape: option.value })}
            />
          ))}
        </div>
      </section>

      <section>
        <h3>Style details</h3>
        <div className="chip-row">
          {styleOptions.map((option) => (
            <ChipButton
              key={option.value}
              label={option.label}
              selected={value.selection.styles.includes(option.value)}
              onClick={() => toggleArrayValue('styles', option.value)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3>Add-ons</h3>
        <div className="chip-row">
          {addonOptions.map((option) => (
            <ChipButton
              key={option.value}
              label={option.label}
              selected={value.selection.addons.includes(option.value)}
              onClick={() => toggleArrayValue('addons', option.value)}
            />
          ))}
        </div>
      </section>

      <label className="field">
        <span>Other notes</span>
        <textarea
          value={value.selection.otherNotes}
          onChange={(event) => updateSelection({ otherNotes: event.target.value })}
        />
      </label>
    </div>
  );
}
