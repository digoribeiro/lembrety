import { calculateNextOccurrence } from '../../../src/services/recurrenceService';

describe('RecurrenceService', () => {
  describe('calculateNextOccurrence', () => {
    it('deve calcular próxima ocorrência diária', () => {
      const currentDate = new Date('2025-07-11T14:00:00.000Z');
      const result = calculateNextOccurrence(currentDate, 'DAILY', '1');
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getDate()).toBe(12); // Próximo dia
      expect(result?.getMonth()).toBe(6); // Julho
      expect(result?.getFullYear()).toBe(2025);
    });

    it('deve calcular próxima ocorrência semanal', () => {
      const currentDate = new Date('2025-07-11T14:00:00.000Z'); // Sexta-feira
      const result = calculateNextOccurrence(currentDate, 'WEEKLY', '1');
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getDate()).toBe(18); // Próxima sexta (7 dias depois)
      expect(result?.getMonth()).toBe(6); // Julho
    });

    it('deve calcular próxima ocorrência mensal', () => {
      const currentDate = new Date('2025-07-11T14:00:00.000Z');
      const result = calculateNextOccurrence(currentDate, 'MONTHLY', '1');
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(7); // Próximo mês (agosto = 7)
      expect(result?.getDate()).toBe(11); // Mesmo dia
    });

    it('deve calcular próxima ocorrência para dias específicos', () => {
      const currentDate = new Date('2025-07-11T14:00:00.000Z'); // Sexta-feira (5)
      const result = calculateNextOccurrence(currentDate, 'SPECIFIC_DAYS', '1,3,5'); // Seg, Qua, Sex
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getDay()).toBe(1); // Próxima segunda-feira
      expect(result?.getDate()).toBe(14); // Segunda-feira da próxima semana
    });

    it('deve lidar com dia específico da semana', () => {
      const currentDate = new Date('2025-07-11T14:00:00.000Z'); // Sexta-feira (5)
      const result = calculateNextOccurrence(currentDate, 'WEEKLY', '1'); // Toda semana (7 dias)
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getDay()).toBe(5); // Sexta-feira (mesmo dia da semana)
      expect(result?.getDate()).toBe(18); // Sexta-feira da próxima semana
    });

    it('deve retornar null para tipo inválido', () => {
      const currentDate = new Date('2025-07-11T14:00:00.000Z');
      const result = calculateNextOccurrence(currentDate, 'INVALID' as any, '1');
      
      expect(result).toBeNull();
    });
  });
}); 