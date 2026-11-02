import { MARGEN_VENTANA, SEPARACION_MENU, calcularPosicionMenu } from './posicion-menu';

const VENTANA = { ancho: 1366, alto: 850 };
const MENU = { ancho: 200, alto: 150 };

describe('calcularPosicionMenu', () => {
  it('abreBajoElSegmentoAlineadoASuBordeDerecho', () => {
    const posicion = calcularPosicionMenu({ top: 100, bottom: 148, right: 900 }, MENU, VENTANA);

    expect(posicion.haciaArriba).toBe(false);
    expect(posicion.top).toBe(148 + SEPARACION_MENU);
    expect(posicion.left).toBe(900 - MENU.ancho);
  });

  it('abreHaciaArribaSiNoCabeAbajo', () => {
    const posicion = calcularPosicionMenu({ top: 760, bottom: 808, right: 900 }, MENU, VENTANA);

    expect(posicion.haciaArriba).toBe(true);
    expect(posicion.top).toBe(760 - SEPARACION_MENU - MENU.alto);
  });

  it('sigueAbajoSiArribaTampocoHayMasEspacio', () => {
    const ventanaBaja = { ancho: 390, alto: 260 };
    const posicion = calcularPosicionMenu({ top: 60, bottom: 108, right: 300 }, MENU, ventanaBaja);

    expect(posicion.haciaArriba).toBe(false);
    expect(posicion.top).toBe(108 + SEPARACION_MENU);
  });

  it('noSeSaleDeLaVentanaPorLaIzquierda', () => {
    const posicion = calcularPosicionMenu({ top: 100, bottom: 148, right: 120 }, MENU, {
      ancho: 390,
      alto: 844,
    });

    expect(posicion.left).toBe(MARGEN_VENTANA);
  });

  it('noSeSaleDeLaVentanaPorLaDerecha', () => {
    const posicion = calcularPosicionMenu({ top: 100, bottom: 148, right: 400 }, MENU, {
      ancho: 390,
      alto: 844,
    });

    expect(posicion.left).toBe(390 - MARGEN_VENTANA - MENU.ancho);
  });
});
