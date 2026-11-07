import { describe, expect, it } from 'vitest';
import { groupByMuscle, type MuscleId, musclesLabel, musclesOf, sortMuscles } from './muscles';

const ex = (name: string, ...muscles: MuscleId[]) => ({ name, muscles });

describe('muscles', () => {
  it('sorts from the top of the body down, without repeats', () => {
    expect(sortMuscles(['calves', 'triceps', 'chest', 'triceps'])).toEqual(['chest', 'triceps', 'calves']);
  });

  it('names several groups', () => {
    expect(musclesLabel(['triceps', 'chest'])).toBe('Грудь, Трицепс');
    expect(musclesLabel([])).toBe('Без группы');
  });

  it('collects every muscle of a workout', () => {
    expect(musclesOf([ex('Жим', 'chest', 'triceps'), ex('Тяга', 'back'), ex('Брусья', 'triceps')])).toEqual([
      'chest',
      'back',
      'triceps',
    ]);
  });
});

describe('groupByMuscle', () => {
  it('orders groups from the top of the body down and names alphabetically', () => {
    const groups = groupByMuscle([
      ex('Приседания', 'legs'),
      ex('Подтягивания', 'back'),
      ex('Становая тяга', 'lowerBack'),
      ex('Гиперэкстензия', 'lowerBack'),
      ex('Подъёмы на носки', 'calves'),
      ex('Скручивания', 'abs'),
    ]);
    expect(groups.map((g) => g.muscle)).toEqual(['back', 'lowerBack', 'abs', 'legs', 'calves']);
    expect(groups[1].items.map((i) => i.name)).toEqual(['Гиперэкстензия', 'Становая тяга']);
  });

  it('lists an exercise for several muscles under each of them', () => {
    const groups = groupByMuscle([ex('Жим лёжа', 'chest', 'triceps', 'shoulders'), ex('Французский жим', 'triceps')]);
    expect(groups.map((g) => [g.muscle, g.items.map((i) => i.name)])).toEqual([
      ['shoulders', ['Жим лёжа']],
      ['chest', ['Жим лёжа']],
      ['triceps', ['Жим лёжа', 'Французский жим']],
    ]);
  });

  it('keeps an exercise without groups findable at the end', () => {
    const groups = groupByMuscle([ex('Что-то', ...[]), ex('Жим', 'chest')]);
    expect(groups.map((g) => g.muscle)).toEqual(['chest', null]);
  });
});
