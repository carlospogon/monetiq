/**
 * Categorizer module based on keywords.
 */

export class Categorizer {
    constructor() {
        this.categories = {
            'Carnes': ['pollo', 'pavo', 'ternera', 'cerdo', 'lomo', 'solomillo', 'burguer', 'hamburguesa', 'jamón', 'longaniza', 'salchicha', 'morcilla', 'chorizo', 'bacon', 'panceta', 'costilla', 'chuleta', 'filete', 'bistec', 'entrecot', 'muslo', 'pechuga', 'alas', 'carne', 'albóndigas', 'sobrasada'],
            'Pescado y Marisco': ['pescado', 'merluza', 'salmón', 'bacalao', 'atún', 'sardina', 'boquerón', 'calamar', 'sepia', 'pulpo', 'gamba', 'langostino', 'mejillón', 'almeja', 'rodaja', 'dorada', 'lubina', 'trucha', 'perca', 'rape', 'bonito', 'anchoa'],
            'Lácteos': ['leche', 'yogur', 'queso', 'mantequilla', 'nata', 'postre', 'kefir', 'actimel', 'margarina', 'flan', 'natillas', 'cuajada', 'batido', 'requesón', 'mascarpone', 'mozzarella'],
            'Frutas y Verduras': ['manzana', 'pera', 'plátano', 'banana', 'naranja', 'limón', 'patata', 'cebolla', 'zanahoria', 'tomate', 'lechuga', 'ensalada', 'aguacate', 'pimento', 'pimiento', 'ajo', 'calabacín', 'berenjena', 'pepino', 'uva', 'melón', 'sandía', 'fresa', 'cereza', 'mandarina', 'pomelo', 'lima', 'coco', 'piña', 'kiwi', 'espinaca', 'acelga', 'repollo', 'coliflor', 'brócoli', 'judía', 'guisante', 'haba', 'maíz', 'champiñón', 'seta', 'verdura', 'fruta'],
            'Panadería': ['pan', 'barra', 'hogaza', 'croissant', 'bollo', 'tostada', 'harina', 'levadura', 'baguette', 'molde', 'chapata', 'magdalena', 'bizcocho', 'donut', 'rosquilla', 'ensaimada', 'tarta', 'pastel'],
            'Bebidas': ['agua', 'refresco', 'coca', 'fanta', 'pepsi', 'cerveza', 'vino', 'zumo', 'néctar', 'licor', 'soda', 'kas', 'seven', 'sprite', 'tónica', 'alcohol', 'ginebra', 'ron', 'whisky', 'vodka', 'tequila', 'brandy', 'coñac', 'anís', 'sidra', 'cava', 'champán'],
            'Limpieza y Hogar': ['detergente', 'suavizante', 'lavavajillas', 'fregasuelos', 'lejía', 'amoniaco', 'limpiacristales', 'quitagrasas', 'ambientador', 'estropajo', 'bayeta', 'fregona', 'escoba', 'recogedor', 'cubo', 'basura', 'bolsa', 'papel', 'servilleta', 'rollo', 'aluminio', 'film', 'batería', 'pila', 'bombilla'],
            'Higiene': ['champú', 'gel', 'jabón', 'desodorante', 'pasta', 'cepillo', 'crema', 'colonia', 'perfume', 'compresa', 'tampón', 'protegeslip', 'pañal', 'toallita', 'papel higienico', 'acondicionador', 'mascarilla', 'loción', 'aceite', 'afeitado', 'cuchilla'],
            'Congelados': ['congelado', 'helado', 'pizza', 'nuggets', 'croquetas', 'empanadilla'],
            'Snacks': ['patatas fritas', 'chips', 'chocolate', 'bombón', 'galleta', 'turrón', 'caramelo', 'chicle', 'doritos', 'nachos', 'pipas', 'kikos', 'frutos secos', 'pistacho', 'almendra', 'nuez', 'avellana', 'gominola', 'pasticceria'],
            'Despensa': ['arroz', 'pasta', 'macarrones', 'espagueti', 'fideo', 'tallarín', 'legumbre', 'lenteja', 'garbanzo', 'aceite', 'vinagre', 'sal', 'azúcar', 'huevo', 'atún', 'salsa', 'tomate frito', 'mayonesa', 'ketchup', 'mostaza', 'especias', 'pimienta', 'orégano', 'pimentón', 'canela', 'café', 'té', 'infusión', 'cacao', 'mermelada', 'miel', 'cereales', 'galletas'],
            'Mascotas': ['perro', 'gato', 'pienso', 'arena', 'collar', 'correa', 'juguete'],
        };
    }

    categorize(description) {
        if (!description) return 'Otros';
        const lowerDesc = description.toLowerCase();

        // Priority Checks (Specific overrides)
        if (lowerDesc.includes('papel higienico')) return 'Higiene';
        if (lowerDesc.includes('papel cocina')) return 'Limpieza y Hogar';

        for (const [category, keywords] of Object.entries(this.categories)) {
            if (keywords.some(keyword => lowerDesc.includes(keyword))) {
                return category;
            }
        }

        return 'Otros';
    }

    getCategories() {
        return Object.keys(this.categories).sort().concat(['Otros']);
    }
}
