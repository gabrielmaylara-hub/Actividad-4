'use strict';

const Product = require('../../src/models/Product');
const controller = require('../../src/controllers/productController');
const { user, product, response } = require('../helpers');

describe('Controlador de productos', () => {
  let req; let res;
  beforeEach(() => {
    req = { user, params: { id: product._id }, validated: { name: 'Nuevo nombre', sku: 'NUEVO-01', priceInCents: 1000, stock: 2, category: 'Oficina', description: '' } };
    res = response();
  });

  test('crear asigna propietario desde la sesión y convierte centavos en la respuesta', async () => {
    jest.spyOn(Product, 'create').mockResolvedValue(product);
    await controller.create(req, res);
    expect(Product.create).toHaveBeenCalledWith({ ...req.validated, owner: user._id });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ product: expect.objectContaining({ id: product._id, price: 259.9 }) });
    const output = res.json.mock.calls[0][0].product;
    expect(output).not.toHaveProperty('owner');
    expect(output).not.toHaveProperty('priceInCents');
  });

  test('listar restringe a propietario, pagina y trata metacaracteres como búsqueda literal', async () => {
    const limit = jest.fn().mockResolvedValue([product]);
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    jest.spyOn(Product, 'find').mockReturnValue({ sort });
    jest.spyOn(Product, 'countDocuments').mockResolvedValue(13);
    req.validatedQuery = { q: '.*', category: 'Tecnología', page: 2, limit: 10 };
    await controller.list(req, res);
    const filter = Product.find.mock.calls[0][0];
    expect(filter.owner).toBe(user._id);
    expect(filter.category).toBe('Tecnología');
    expect(filter.$or[0].name.test('texto cualquiera')).toBe(false);
    expect(filter.$or[0].name.test('nombre .* literal')).toBe(true);
    expect(Product.countDocuments).toHaveBeenCalledWith(filter);
    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ pagination: { page: 2, limit: 10, total: 13, pages: 2 } }));
  });

  test('consulta un producto con identificador y propietario juntos', async () => {
    jest.spyOn(Product, 'findOne').mockResolvedValue(product);
    await controller.show(req, res);
    expect(Product.findOne).toHaveBeenCalledWith({ _id: product._id, owner: user._id });
    expect(res.json).toHaveBeenCalledWith({ product: expect.objectContaining({ sku: product.sku }) });
  });

  test('actualizar aplica validaciones del modelo y restringe propietario', async () => {
    jest.spyOn(Product, 'findOneAndUpdate').mockResolvedValue({ ...product, ...req.validated });
    await controller.update(req, res);
    expect(Product.findOneAndUpdate).toHaveBeenCalledWith({ _id: product._id, owner: user._id }, { $set: req.validated }, { new: true, runValidators: true });
    expect(res.json).toHaveBeenCalledWith({ product: expect.objectContaining({ name: 'Nuevo nombre', price: 10 }) });
  });

  test('eliminar restringe propietario y responde sin contenido', async () => {
    jest.spyOn(Product, 'findOneAndDelete').mockResolvedValue(product);
    await controller.remove(req, res);
    expect(Product.findOneAndDelete).toHaveBeenCalledWith({ _id: product._id, owner: user._id });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  test.each([['show', 'findOne'], ['update', 'findOneAndUpdate'], ['remove', 'findOneAndDelete']])('%s devuelve 404 para producto ajeno o inexistente', async (action, modelMethod) => {
    jest.spyOn(Product, modelMethod).mockResolvedValue(null);
    await expect(controller[action](req, res)).rejects.toMatchObject({ status: 404, code: 'PRODUCT_NOT_FOUND' });
    expect(res.json).not.toHaveBeenCalled();
  });

  test.each([['show', 'findOne'], ['create', 'create'], ['update', 'findOneAndUpdate'], ['remove', 'findOneAndDelete']])('%s propaga errores de persistencia al manejador central', async (action, modelMethod) => {
    const error = new Error('Error de almacenamiento');
    jest.spyOn(Product, modelMethod).mockRejectedValue(error);
    await expect(controller[action](req, res)).rejects.toBe(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
