#version 300 es

precision highp float;

out vec4 FragColor;
in vec3 fragPos;  
in vec3 normal;  

struct Material {
    vec3 diffuse;     
    vec3 specular;
    float shininess;
};

struct Light {
    //vec3 position;
    vec3 direction;
    vec3 ambient; // ambient 적용 strength
    vec3 diffuse; // diffuse 적용 strength
    vec3 specular; // specular 적용 strength
};

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;
uniform int u_toonLevel;

void main() {
    // ambient
    vec3 ambient = light.ambient * material.diffuse;
  	
    // diffuse 
    vec3 norm = normalize(normal);
    //vec3 lightDir = normalize(light.position - fragPos);
    vec3 lightDir = normalize(light.direction);
    float dotNormLight = dot(norm, lightDir);
    float diff = max(dotNormLight, 0.0);
    
    
    // specular
    vec3 viewDir = normalize(u_viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = 0.0;
    if (dotNormLight > 0.0) {
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    }
    float level = float(u_toonLevel);
    diff = diff * level;
    spec = spec * level;
     

    if (diff <= 1.0){
        diff = 0.5 / level;
    }
    else if (diff <= 2.0){
        diff = 1.5 / level;
    }
    else if (diff <= 3.0){
        diff = 2.5 / level;
    }
    else if (diff <= 4.0){
        diff = 3.5 / level;
    }
    else{
        diff = 4.5 / level;
    }

    if (spec <= 1.0){
        spec = 0.5 / level;
    }
    else if (spec <= 2.0){
        spec = 1.5 / level;
    }
    else if (spec <= 3.0){
        spec = 2.5 / level;
    }
    else if (spec <= 4.0){
        spec = 3.5 / level;
    }
    else{
        spec = 4.5 / level;
    }

    vec3 diffuse = light.diffuse * diff * material.diffuse;
    vec3 specular = light.specular * spec * material.specular;  
        
    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
} 