import { User } from 'firebase/auth';

import { reautenticarYCambiarClave, tieneProveedorClave } from './servicio-autenticacion';

function usuarioConProveedores(...proveedores: string[]): User {
  return { providerData: proveedores.map((providerId) => ({ providerId })) } as unknown as User;
}

describe('tieneProveedorClave', () => {
  it('devuelveFalseSoloConProveedorGoogle', () => {
    expect(tieneProveedorClave(usuarioConProveedores('google.com'))).toBe(false);
  });

  it('devuelveTrueConProveedorGoogleYPassword', () => {
    expect(tieneProveedorClave(usuarioConProveedores('google.com', 'password'))).toBe(true);
  });

  it('devuelveFalseSinSesion', () => {
    expect(tieneProveedorClave(null)).toBe(false);
  });
});

describe('reautenticarYCambiarClave', () => {
  it('ejecutaReautenticarAntesDeActualizar', async () => {
    const orden: string[] = [];

    await reautenticarYCambiarClave(
      async () => {
        orden.push('reautenticar');
      },
      async () => {
        orden.push('actualizar');
      },
    );

    expect(orden).toEqual(['reautenticar', 'actualizar']);
  });

  it('siReautenticarFallaNuncaLlamaAActualizar', async () => {
    const actualizar = vi.fn().mockResolvedValue(undefined);

    await expect(
      reautenticarYCambiarClave(() => Promise.reject({ code: 'auth/wrong-password' }), actualizar),
    ).rejects.toEqual({ code: 'auth/wrong-password' });

    expect(actualizar).not.toHaveBeenCalled();
  });
});
