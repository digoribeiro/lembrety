// Teste simples para verificar se Jest está funcionando
describe('Sistema de Testes', () => {
  it('deve somar dois números corretamente', () => {
    expect(2 + 2).toBe(4);
  });

  it('deve verificar se Jest está configurado', () => {
    expect(true).toBeTruthy();
  });

  it('deve verificar se mocks funcionam', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
}); 